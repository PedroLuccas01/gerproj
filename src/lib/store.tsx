"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { durationFromRange, endFromDuration, todayIso } from "./dates";
import { statusAfterScheduleChange } from "./schedule-progress";
import { applySetProgress, applyToggleComplete, syncAllParentProgress } from "./task-complete";
import type {
  AppState,
  Client,
  ClientDraft,
  Collaborator,
  CollaboratorDraft,
  Project,
  ProjectDraft,
  ProjectStatus,
  Task,
  TaskPhase,
} from "./types";

const TEMP_TASK_PREFIX = "tmp_";

function isTempTaskId(id: string) {
  return id.startsWith(TEMP_TASK_PREFIX);
}

function withoutRemovedTasks(tasks: Task[], removed: Set<string>) {
  return tasks
    .filter((task) => !removed.has(task.id))
    .map((task) => ({
      ...task,
      dependencies: task.dependencies.filter((dep) => !removed.has(dep)),
    }));
}

const emptyState: AppState = {
  collaborators: [],
  clients: [],
  projects: [],
  tasks: [],
};

type StoreContextValue = {
  hydrated: boolean;
  state: AppState;
  addProject: (draft: ProjectDraft) => Promise<Project>;
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addTask: (input: {
    projectId: string;
    phase: TaskPhase;
    parentId?: string | null;
    name?: string;
  }) => Promise<Task>;
  pasteTasks: (input: { projectId: string; phase: TaskPhase; tree: unknown }) => Promise<{
    rootId: string;
    tasks: Task[];
  }>;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => Promise<void>;
  setTaskProgress: (id: string, progress: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addCollaborator: (draft: CollaboratorDraft) => Promise<Collaborator>;
  updateCollaborator: (id: string, patch: Partial<Collaborator> & { password?: string }) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;
  addClient: (draft: ClientDraft) => Promise<Client>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401) {
    throw new Error("UNAUTHENTICATED");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Falha ao falar com o servidor.");
  }
  return res.json() as Promise<T>;
}

function applyProjectPatch(project: Project, patch: Partial<Project>): Project {
  const next = { ...project, ...patch };
  if (patch.startDate && patch.endDate) {
    next.durationDays = durationFromRange(next.startDate, next.endDate);
  } else if (patch.startDate && patch.durationDays) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  } else if (patch.endDate && next.startDate) {
    next.durationDays = durationFromRange(next.startDate, next.endDate);
  } else if (patch.durationDays && next.startDate) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  }
  return next;
}

function applyTaskPatch(task: Task, patch: Partial<Task>): Task {
  const next = { ...task, ...patch };
  if (patch.startDate !== undefined || patch.endDate !== undefined) {
    if (next.startDate && next.endDate) {
      next.durationDays = durationFromRange(next.startDate, next.endDate);
    }
  } else if (patch.durationDays !== undefined && next.startDate) {
    next.endDate = endFromDuration(next.startDate, next.durationDays);
  }
  return next;
}

function withSyncedProjectStatus(state: AppState, projectId: string): AppState {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return state;
  const status = statusAfterScheduleChange(
    project.status,
    state.tasks.filter((task) => task.projectId === projectId),
  );
  if (status === project.status) return state;
  return {
    ...state,
    projects: state.projects.map((item) => (item.id === projectId ? { ...item, status } : item)),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, hydrated: authHydrated } = useAuth();
  const [state, setState] = useState<AppState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const pendingTasks = useRef<Record<string, Partial<Task>>>({});
  const taskTimers = useRef<Record<string, number>>({});
  const taskFlushGen = useRef<Record<string, number>>({});
  const cancelledTempAdds = useRef(new Set<string>());

  const reload = useCallback(async () => {
    const data = await api<AppState>("/api/state");
    setState({
      ...data,
      tasks: syncAllParentProgress(data.tasks, todayIso()),
    });
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (!user || user.status !== "active") {
      setState(emptyState);
      setHydrated(true);
      return;
    }
    let cancelled = false;
    reload()
      .catch(() => {
        if (!cancelled) setState(emptyState);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authHydrated, user, reload]);

  const addProject = useCallback(async (draft: ProjectDraft) => {
    const created = await api<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    setState((prev) => ({ ...prev, projects: [created, ...prev.projects] }));
    return created;
  }, []);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? applyProjectPatch(p, patch) : p)),
    }));
    const saved = await api<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? saved : p)),
    }));
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await api(`/api/projects/${id}`, { method: "DELETE" });
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      tasks: prev.tasks.filter((t) => t.projectId !== id),
    }));
  }, []);

  const flushTask = useCallback(async (id: string) => {
    if (isTempTaskId(id)) return;
    const patch = pendingTasks.current[id];
    if (!patch) return;
    delete pendingTasks.current[id];
    const gen = (taskFlushGen.current[id] ?? 0) + 1;
    taskFlushGen.current[id] = gen;
    try {
      const saved = await api<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (taskFlushGen.current[id] !== gen) return;
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (t.id !== id) return t;
          const newer = pendingTasks.current[id];
          return newer ? applyTaskPatch(saved, newer) : saved;
        }),
      }));
    } catch {
      pendingTasks.current[id] = { ...patch, ...pendingTasks.current[id] };
    }
  }, []);

  const addTask = useCallback(
    async (input: { projectId: string; phase: TaskPhase; parentId?: string | null; name?: string }) => {
      const tempId = `${TEMP_TASK_PREFIX}${crypto.randomUUID()}`;
      setState((prev) => {
        const projectTasks = prev.tasks.filter((task) => task.projectId === input.projectId);
        const parentId = input.parentId ?? null;
        const siblings = projectTasks.filter(
          (task) => task.phase === input.phase && (task.parentId ?? null) === parentId,
        );
        const optimistic: Task = {
          id: tempId,
          projectId: input.projectId,
          parentId,
          phase: input.phase,
          seq: projectTasks.reduce((max, task) => Math.max(max, task.seq), 0) + 1,
          name: input.name ?? "Nova tarefa",
          startDate: null,
          endDate: null,
          durationDays: 1,
          assigneeIds: [],
          progress: 0,
          completed: false,
          completedAt: null,
          dependencies: [],
          order: siblings.reduce((max, task) => Math.max(max, task.order), -1) + 1,
          collapsed: false,
        };
        return withSyncedProjectStatus({ ...prev, tasks: [...prev.tasks, optimistic] }, input.projectId);
      });

      try {
        const created = await api<Task>("/api/tasks", {
          method: "POST",
          body: JSON.stringify(input),
        });
        if (cancelledTempAdds.current.has(tempId)) {
          cancelledTempAdds.current.delete(tempId);
          void api(`/api/tasks/${created.id}`, { method: "DELETE" }).catch(() => undefined);
          return created;
        }
        const pending = pendingTasks.current[tempId];
        if (pending) {
          delete pendingTasks.current[tempId];
          pendingTasks.current[created.id] = pending;
          window.clearTimeout(taskTimers.current[tempId]);
          delete taskTimers.current[tempId];
        }
        const parentId = input.parentId ?? null;
        const parentPatch = { current: null as Task | null };
        setState((prev) => {
          const mapped = prev.tasks.map((task) => {
            if (task.id !== tempId) return task;
            return {
              ...created,
              name: task.name,
              durationDays: task.durationDays,
              startDate: task.startDate,
              endDate: task.endDate,
              assigneeIds: task.assigneeIds,
              dependencies: task.dependencies,
              collapsed: task.collapsed,
              progress: task.progress,
              completed: task.completed,
              completedAt: task.completedAt,
            };
          });
          const synced = syncAllParentProgress(mapped, todayIso());
          if (parentId) {
            const before = prev.tasks.find((task) => task.id === parentId);
            const after = synced.find((task) => task.id === parentId);
            if (
              before &&
              after &&
              (before.progress !== after.progress ||
                before.completed !== after.completed ||
                before.completedAt !== after.completedAt)
            ) {
              parentPatch.current = after;
            }
          }
          return withSyncedProjectStatus({ ...prev, tasks: synced }, input.projectId);
        });
        if (parentPatch.current) {
          const parent = parentPatch.current;
          void api(`/api/tasks/${parent.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              progress: parent.progress,
              completed: parent.completed,
              completedAt: parent.completedAt,
            }),
          }).catch(() => undefined);
        }
        if (pending) {
          window.clearTimeout(taskTimers.current[created.id]);
          taskTimers.current[created.id] = window.setTimeout(() => {
            void flushTask(created.id);
          }, 0);
        }
        return created;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((task) => task.id !== tempId),
        }));
        throw error;
      }
    },
    [flushTask],
  );

  const pasteTasks = useCallback(
    async (input: { projectId: string; phase: TaskPhase; tree: unknown }) => {
      const created = await api<{ rootId: string; tasks: Task[] }>("/api/tasks/paste", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setState((prev) => {
        const existing = new Set(prev.tasks.map((task) => task.id));
        const incoming = created.tasks.filter((task) => !existing.has(task.id));
        return withSyncedProjectStatus(
          {
            ...prev,
            tasks: syncAllParentProgress([...prev.tasks, ...incoming], todayIso()),
          },
          input.projectId,
        );
      });
      return created;
    },
    [],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      pendingTasks.current[id] = { ...pendingTasks.current[id], ...patch };
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? applyTaskPatch(t, patch) : t)),
      }));
      window.clearTimeout(taskTimers.current[id]);
      if (isTempTaskId(id)) return;
      taskTimers.current[id] = window.setTimeout(() => {
        void flushTask(id);
      }, 350);
    },
    [flushTask],
  );

  const applyToggleResponse = useCallback(
    (data: { tasks: Task[]; projectId?: string; projectStatus?: ProjectStatus }) => {
      setState((prev) => {
        const next: AppState = {
          ...prev,
          tasks: prev.tasks.map((t) => {
            const server = data.tasks.find((n) => n.id === t.id);
            if (!server) return t;
            const newer = pendingTasks.current[t.id];
            return newer ? applyTaskPatch(server, newer) : server;
          }),
        };
        if (!data.projectId || !data.projectStatus) return next;
        return {
          ...next,
          projects: next.projects.map((project) =>
            project.id === data.projectId ? { ...project, status: data.projectStatus as ProjectStatus } : project,
          ),
        };
      });
    },
    [],
  );

  const toggleTask = useCallback(async (id: string) => {
    setState((prev) => {
      const target = prev.tasks.find((task) => task.id === id);
      const next = { ...prev, tasks: applyToggleComplete(prev.tasks, id, todayIso()) };
      return target ? withSyncedProjectStatus(next, target.projectId) : next;
    });
    if (isTempTaskId(id)) return;
    const data = await api<{ tasks: Task[]; projectId?: string; projectStatus?: ProjectStatus }>(
      `/api/tasks/${id}/toggle`,
      { method: "POST" },
    );
    applyToggleResponse(data);
  }, [applyToggleResponse]);

  const setTaskProgress = useCallback(async (id: string, progress: number) => {
    setState((prev) => {
      const target = prev.tasks.find((task) => task.id === id);
      const next = { ...prev, tasks: applySetProgress(prev.tasks, id, progress, todayIso()) };
      return target ? withSyncedProjectStatus(next, target.projectId) : next;
    });
    if (isTempTaskId(id)) return;
    const data = await api<{ tasks: Task[]; projectId?: string; projectStatus?: ProjectStatus }>(
      `/api/tasks/${id}/toggle`,
      { method: "POST", body: JSON.stringify({ progress }) },
    );
    applyToggleResponse(data);
  }, [applyToggleResponse]);

  const deleteTask = useCallback(async (id: string) => {
    if (isTempTaskId(id)) {
      cancelledTempAdds.current.add(id);
      setState((prev) => {
        const projectId = prev.tasks.find((task) => task.id === id)?.projectId;
        const removed = new Set([
          id,
          ...prev.tasks.filter((task) => task.parentId === id).map((task) => task.id),
        ]);
        const next = {
          ...prev,
          tasks: withoutRemovedTasks(prev.tasks, removed),
        };
        return projectId ? withSyncedProjectStatus(next, projectId) : next;
      });
      return;
    }

    let snapshot: AppState | null = null;
    setState((prev) => {
      snapshot = prev;
      const projectId = prev.tasks.find((task) => task.id === id)?.projectId;
      const removed = new Set([
        id,
        ...prev.tasks.filter((task) => task.parentId === id).map((task) => task.id),
      ]);
      const next = {
        ...prev,
        tasks: withoutRemovedTasks(prev.tasks, removed),
      };
      return projectId ? withSyncedProjectStatus(next, projectId) : next;
    });

    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
    } catch (error) {
      if (snapshot) setState(snapshot);
      throw error;
    }
  }, []);

  const addCollaborator = useCallback(async (draft: CollaboratorDraft) => {
    const created = await api<Collaborator>("/api/collaborators", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    setState((prev) => ({ ...prev, collaborators: [...prev.collaborators, created] }));
    return created;
  }, []);

  const updateCollaborator = useCallback(
    async (id: string, patch: Partial<Collaborator> & { password?: string }) => {
      const saved = await api<Collaborator>(`/api/collaborators/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setState((prev) => ({
        ...prev,
        collaborators: prev.collaborators.map((c) => (c.id === id ? saved : c)),
      }));
    },
    [],
  );

  const deleteCollaborator = useCallback(async (id: string) => {
    await api(`/api/collaborators/${id}`, { method: "DELETE" });
    setState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== id),
      projects: prev.projects.map((p) => ({
        ...p,
        leaderId: p.leaderId === id ? null : p.leaderId,
        teamIds: p.teamIds.filter((tid) => tid !== id),
      })),
      tasks: prev.tasks.map((t) => ({
        ...t,
        assigneeIds: t.assigneeIds.filter((aid) => aid !== id),
      })),
    }));
  }, []);

  const addClient = useCallback(async (draft: ClientDraft) => {
    const created = await api<Client>("/api/clients", {
      method: "POST",
      body: JSON.stringify(draft),
    });
    setState((prev) => ({ ...prev, clients: [...prev.clients, created] }));
    return created;
  }, []);

  const updateClient = useCallback(async (id: string, patch: Partial<Client>) => {
    const saved = await api<Client>(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setState((prev) => ({
      ...prev,
      clients: prev.clients.map((c) => (c.id === id ? saved : c)),
    }));
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    await api(`/api/clients/${id}`, { method: "DELETE" });
    setState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== id),
      projects: prev.projects.map((p) => ({
        ...p,
        clientId: p.clientId === id ? null : p.clientId,
      })),
    }));
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      hydrated,
      state,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      pasteTasks,
      updateTask,
      toggleTask,
      setTaskProgress,
      deleteTask,
      addCollaborator,
      updateCollaborator,
      deleteCollaborator,
      addClient,
      updateClient,
      deleteClient,
    }),
    [
      hydrated,
      state,
      addProject,
      updateProject,
      deleteProject,
      addTask,
      pasteTasks,
      updateTask,
      toggleTask,
      setTaskProgress,
      deleteTask,
      addCollaborator,
      updateCollaborator,
      deleteCollaborator,
      addClient,
      updateClient,
      deleteClient,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore deve ser usado dentro de StoreProvider");
  return ctx;
}
