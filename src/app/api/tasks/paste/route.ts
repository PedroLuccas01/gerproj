import { NextResponse } from "next/server";
import { requireManagement } from "@/lib/access";
import { recordAudit, statusAudit, toAuditActor } from "@/lib/audit";
import { handleApiError, jsonError } from "@/lib/api-utils";
import { mapTask, parseOptionalDate } from "@/lib/mappers";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/session";
import { TASK_INCLUDE } from "@/lib/task-query";
import {
  collectAssigneeIds,
  countTreeNodes,
  parseTaskTree,
  type TaskTreeNode,
} from "@/lib/task-clipboard";
import { syncProjectStatusFromSchedule } from "@/lib/sync-project-status";
import type { TaskPhase } from "@/lib/types";

const PHASES: TaskPhase[] = ["planejamento", "desenvolvimento", "testes", "entrega", "finalizado"];

export async function POST(request: Request) {
  try {
    const access = await requireAccess();
    requireManagement(access);
    const body = (await request.json()) as {
      projectId?: string;
      phase?: TaskPhase;
      tree?: unknown;
    };
    if (!body.projectId || !body.phase || !PHASES.includes(body.phase)) {
      return jsonError("Projeto e fase são obrigatórios.");
    }
    const tree = parseTaskTree(body.tree);
    if (!tree) return jsonError("Árvore de atividades inválida.");
    if (countTreeNodes(tree) > 80) return jsonError("A estrutura copiada é grande demais para colar de uma vez.");

    const project = await prisma.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, status: true, name: true },
    });
    if (!project) return jsonError("Projeto não encontrado.", 404);

    const assigneeIds = [...collectAssigneeIds(tree)];
    const [validAssignees, seqAgg, orderAgg] = await Promise.all([
      assigneeIds.length
        ? prisma.collaborator.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true },
          })
        : Promise.resolve([]),
      prisma.task.aggregate({
        where: { projectId: body.projectId },
        _max: { seq: true },
      }),
      prisma.task.aggregate({
        where: { projectId: body.projectId, phase: body.phase, parentId: null },
        _max: { order: true },
      }),
    ]);
    const validAssignee = new Set(validAssignees.map((row) => row.id));

    const createdIds: string[] = [];
    const idMap = new Map<string, string>();
    const pendingDeps: { sourceId: string; dependencies: string[] }[] = [];
    const pendingAssignees: { sourceId: string; assigneeIds: string[] }[] = [];

    await prisma.$transaction(async (tx) => {
      let seq = seqAgg._max.seq ?? 0;

      async function createNode(node: TaskTreeNode, parentId: string | null, order: number, isRoot: boolean) {
        seq += 1;
        const progress = node.completed ? 100 : node.progress;
        const created = await tx.task.create({
          data: {
            projectId: body.projectId!,
            parentId,
            phase: body.phase!,
            seq,
            order,
            name: node.name,
            startDate: parseOptionalDate(node.startDate),
            endDate: parseOptionalDate(node.endDate),
            durationDays: node.durationDays,
            progress,
            completed: progress === 100,
            completedAt: parseOptionalDate(node.completedAt),
            collapsed: isRoot ? false : node.collapsed,
          },
        });
        idMap.set(node.sourceId, created.id);
        createdIds.push(created.id);
        pendingDeps.push({ sourceId: node.sourceId, dependencies: node.dependencies });
        pendingAssignees.push({
          sourceId: node.sourceId,
          assigneeIds: node.assigneeIds.filter((id) => validAssignee.has(id)),
        });
        let childOrder = -1;
        for (const child of node.children) {
          childOrder += 1;
          await createNode(child, created.id, childOrder, false);
        }
      }

      await createNode(tree, null, (orderAgg._max.order ?? -1) + 1, true);

      const depRows: { taskId: string; dependsOnId: string }[] = [];
      const newIds = new Set(createdIds);
      for (const item of pendingDeps) {
        const taskId = idMap.get(item.sourceId);
        if (!taskId) continue;
        const unique = [...new Set(item.dependencies)];
        for (const dep of unique) {
          const mapped = idMap.get(dep) ?? dep;
          if (!mapped || mapped === taskId) continue;
          depRows.push({ taskId, dependsOnId: mapped });
        }
      }

      const externalIds = [...new Set(depRows.map((row) => row.dependsOnId).filter((id) => !newIds.has(id)))];
      const validExternal = externalIds.length
        ? await tx.task.findMany({
            where: { id: { in: externalIds }, projectId: body.projectId },
            select: { id: true },
          })
        : [];
      const allowed = new Set([...newIds, ...validExternal.map((row) => row.id)]);
      const toCreate = depRows.filter((row) => allowed.has(row.dependsOnId));
      if (toCreate.length) {
        await tx.taskDependency.createMany({ data: toCreate });
      }

      const assigneeRows: { taskId: string; collaboratorId: string }[] = [];
      for (const item of pendingAssignees) {
        const taskId = idMap.get(item.sourceId);
        if (!taskId) continue;
        const unique = [...new Set(item.assigneeIds)];
        for (const collaboratorId of unique) {
          assigneeRows.push({ taskId, collaboratorId });
        }
      }
      if (assigneeRows.length) {
        await tx.taskAssignee.createMany({ data: assigneeRows });
      }
    });

    if (project.status === "concluido") {
      await prisma.project.update({
        where: { id: body.projectId },
        data: { status: "em_andamento" },
      });
      const entry = statusAudit({
        actor: toAuditActor(access),
        projectId: body.projectId,
        projectName: project.name,
        from: "concluido",
        to: "em_andamento",
        action: "auto",
      });
      if (entry) await recordAudit(entry);
    } else {
      await syncProjectStatusFromSchedule(body.projectId, toAuditActor(access));
    }

    const rows = await prisma.task.findMany({
      where: { id: { in: createdIds } },
      include: TASK_INCLUDE,
    });
    const byId = new Map(rows.map((row) => [row.id, mapTask(row)]));
    const tasks = createdIds.map((id) => byId.get(id)!).filter(Boolean);
    return NextResponse.json({
      rootId: idMap.get(tree.sourceId) ?? tasks[0]?.id,
      tasks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
