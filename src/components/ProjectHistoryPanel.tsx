"use client";

import { Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, TextArea, TextInput, cn } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useFeedback } from "@/lib/feedback";
import {
  activeMentionQuery,
  filterMentionCandidates,
  formatHistoryTime,
  groupHistoryByDate,
  insertMention,
  mentionHighlightPattern,
  projectTeamMembers,
} from "@/lib/project-history";
import type { Collaborator, Project, ProjectHistoryEntry } from "@/lib/types";

function HistoryContent({
  content,
  members,
}: {
  content: string;
  members: Collaborator[];
}) {
  const pattern = useMemo(() => mentionHighlightPattern(members), [members]);
  if (!pattern) return <>{content}</>;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(content.slice(lastIndex, index));
    parts.push(
      <span key={`${index}-${match[0]}`} className="font-semibold text-blue-600 dark:text-blue-400">
        {match[0]}
      </span>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return <>{parts}</>;
}

function MentionComposer({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  members: Collaborator[];
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0);
  const query = activeMentionQuery(value, cursor);
  const candidates = query === null ? [] : filterMentionCandidates(query, members);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, candidates.length]);

  function pick(member: Collaborator) {
    const input = textareaRef.current;
    const pos = input?.selectionStart ?? cursor;
    const next = insertMention(value, pos, member.name);
    onChange(next.next);
    setCursor(next.cursor);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  return (
    <div className="relative">
      <TextArea
        ref={textareaRef}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
        onKeyUp={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
        onKeyDown={(event) => {
          if (!candidates.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % candidates.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length);
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            pick(candidates[activeIndex]);
          } else if (event.key === "Escape") {
            setCursor(0);
          }
        }}
      />
      {candidates.length ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {candidates.map((member, index) => (
            <button
              key={member.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(member);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                index === activeIndex ? "bg-hover text-ink" : "text-muted hover:bg-hover",
              )}
            >
              <UserRound className="h-4 w-4 shrink-0" />
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectHistoryPanel({
  project,
  collaborators,
  canWrite,
  isManagement,
}: {
  project: Project;
  collaborators: Collaborator[];
  canWrite: boolean;
  isManagement: boolean;
}) {
  const { user } = useAuth();
  const { confirm, notify } = useFeedback();
  const [items, setItems] = useState<ProjectHistoryEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const members = useMemo(
    () => projectTeamMembers(project, collaborators),
    [project, collaborators],
  );

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const response = await fetch(`/api/projects/${project.id}/history?${params.toString()}`);
    const data = (await response.json()) as { items?: ProjectHistoryEntry[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.");
    setItems(data.items ?? []);
  }, [project.id, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    setItems(null);
    load().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
      setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function createEntry() {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as ProjectHistoryEntry & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o registro.");
      setItems((prev) => [data, ...(prev ?? [])]);
      setDraft("");
      setShowComposer(false);
      notify({ type: "success", title: "Registro adicionado" });
    } catch (err) {
      notify({
        type: "error",
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(entryId: string) {
    const content = editDraft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/history/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await response.json()) as ProjectHistoryEntry & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o registro.");
      setItems((prev) => (prev ?? []).map((item) => (item.id === entryId ? data : item)));
      setEditingId(null);
      setEditDraft("");
      notify({ type: "success", title: "Registro atualizado" });
    } catch (err) {
      notify({
        type: "error",
        title: "Não foi possível salvar",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(entry: ProjectHistoryEntry) {
    const ok = await confirm({
      title: "Excluir registro",
      description: "Excluir este registro do histórico do projeto?",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/projects/${project.id}/history/${entry.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir o registro.");
      setItems((prev) => (prev ?? []).filter((item) => item.id !== entry.id));
      notify({ type: "success", title: "Registro excluído" });
    } catch (err) {
      notify({
        type: "error",
        title: "Não foi possível excluir",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const groups = useMemo(() => groupHistoryByDate(items ?? []), [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar no histórico..."
            className="pl-9"
          />
        </div>
        {canWrite ? (
          <Button
            variant={showComposer ? "secondary" : "primary"}
            onClick={() => {
              setShowComposer((open) => !open);
              setEditingId(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Adicionar registro
          </Button>
        ) : null}
      </div>

      {showComposer && canWrite ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <MentionComposer
            value={draft}
            onChange={setDraft}
            members={members}
            placeholder="Descreva o acontecimento. Use @ para mencionar alguém da equipe."
            autoFocus
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowComposer(false); setDraft(""); }}>
              Cancelar
            </Button>
            <Button disabled={saving || !draft.trim()} onClick={() => void createEntry()}>
              Salvar registro
            </Button>
          </div>
        </div>
      ) : null}

      {items === null ? (
        <p className="text-sm text-muted">Carregando histórico...</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <p className="text-sm text-muted">
            {query ? "Nenhum registro encontrado para esta busca." : "Nenhum registro no histórico ainda."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <div className="mb-3 flex items-center gap-3 text-xs font-medium text-faint">
                <span className="h-px flex-1 bg-line-subtle" />
                <span>{group.label}</span>
                <span className="h-px flex-1 bg-line-subtle" />
              </div>
              <ol className="divide-y divide-line-subtle rounded-xl border border-line bg-surface">
                {group.items.map((entry) => {
                  const canEdit = Boolean(user && (isManagement || entry.authorId === user.id));
                  const canDelete = isManagement;
                  const isEditing = editingId === entry.id;

                  return (
                    <li key={entry.id} className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-ink">{entry.authorName}</span>
                            <span className="text-xs text-faint">{formatHistoryTime(entry.createdAt)}</span>
                            {entry.updatedAt !== entry.createdAt ? (
                              <span className="text-[11px] text-faint">· editado</span>
                            ) : null}
                            <div className="ml-auto flex items-center gap-1">
                              {canEdit && !isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(entry.id);
                                    setEditDraft(entry.content);
                                    setShowComposer(false);
                                  }}
                                  className="rounded p-1 text-faint hover:bg-hover hover:text-muted"
                                  title="Editar registro"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => void removeEntry(entry)}
                                  className="rounded p-1 text-faint hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                  title="Excluir registro"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="mt-3 space-y-3">
                              <MentionComposer
                                value={editDraft}
                                onChange={setEditDraft}
                                members={members}
                                rows={4}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditDraft("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  disabled={saving || !editDraft.trim()}
                                  onClick={() => void saveEdit(entry.id)}
                                >
                                  Salvar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                              <HistoryContent content={entry.content} members={members} />
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
