"use client";

import { Pencil, Paperclip, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AttachmentBadge, AttachmentViewerModal, CommentAttachmentPreview } from "@/components/CommentAttachmentPreview";
import { Button, TextArea, TextInput, cn } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import {
  COMMENT_ATTACHMENT_ACCEPT,
  type CommentAttachmentInput,
} from "@/lib/comment-attachments";
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

function AttachmentPicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={COMMENT_ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
        <Paperclip className="h-4 w-4" />
        Anexar arquivo
      </Button>
      {file ? (
        <span className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-2 py-1 text-xs text-muted">
          <Paperclip className="h-3.5 w-3.5" />
          {file.name}
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded p-0.5 hover:bg-hover"
            title="Remover anexo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        <span className="text-xs text-faint">PDF, imagem, Word ou Excel · até 10 MB</span>
      )}
    </div>
  );
}

async function uploadCommentAttachment(projectId: string, file: File): Promise<CommentAttachmentInput> {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/projects/${projectId}/history/upload`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as CommentAttachmentInput & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível enviar o arquivo.");
  return data;
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
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [removeEditAttachment, setRemoveEditAttachment] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const members = useMemo(
    () => projectTeamMembers(project, collaborators),
    [project, collaborators],
  );

  const selectedEntry = useMemo(
    () => (items ?? []).find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  function openAttachmentViewer(entry: ProjectHistoryEntry) {
    if (!entry.attachmentUrl) return;
    setSelectedId(entry.id);
    setViewerOpen(true);
  }

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const response = await fetch(`/api/projects/${project.id}/history?${params.toString()}`);
    const data = (await response.json()) as { items?: ProjectHistoryEntry[]; error?: string };
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os comentários.");
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
      setError(err instanceof Error ? err.message : "Não foi possível carregar os comentários.");
      setItems([]);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!items?.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && items.some((item) => item.id === selectedId)) return;
    const firstWithAttachment = items.find((item) => item.attachmentUrl);
    setSelectedId(firstWithAttachment?.id ?? items[0]?.id ?? null);
  }, [items, selectedId]);

  async function createEntry() {
    const content = draft.trim();
    if (!content && !draftFile) return;
    setSaving(true);
    try {
      const attachment = draftFile ? await uploadCommentAttachment(project.id, draftFile) : null;
      const response = await fetch(`/api/projects/${project.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachment }),
      });
      const data = (await response.json()) as ProjectHistoryEntry & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o comentário.");
      setItems((prev) => [data, ...(prev ?? [])]);
      setSelectedId(data.id);
      setDraft("");
      setDraftFile(null);
      setShowComposer(false);
      notify({ type: "success", title: "Comentário adicionado" });
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

  async function saveEdit(entry: ProjectHistoryEntry) {
    const content = editDraft.trim();
    const hasExistingAttachment = Boolean(entry.attachmentUrl) && !removeEditAttachment;
    if (!content && !editFile && !hasExistingAttachment) return;
    setSaving(true);
    try {
      const attachment = editFile ? await uploadCommentAttachment(project.id, editFile) : undefined;
      const response = await fetch(`/api/projects/${project.id}/history/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachment,
          removeAttachment: removeEditAttachment && !editFile,
        }),
      });
      const data = (await response.json()) as ProjectHistoryEntry & { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o comentário.");
      setItems((prev) => (prev ?? []).map((item) => (item.id === entry.id ? data : item)));
      setSelectedId(data.id);
      setEditingId(null);
      setEditDraft("");
      setEditFile(null);
      setRemoveEditAttachment(false);
      notify({ type: "success", title: "Comentário atualizado" });
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
      title: "Excluir comentário",
      description: "Excluir este comentário do projeto?",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const response = await fetch(`/api/projects/${project.id}/history/${entry.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir o comentário.");
      setItems((prev) => (prev ?? []).filter((item) => item.id !== entry.id));
      if (selectedId === entry.id) setSelectedId(null);
      notify({ type: "success", title: "Comentário excluído" });
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
            placeholder="Pesquisar nos comentários..."
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
            Adicionar comentário
          </Button>
        ) : null}
      </div>

      {showComposer && canWrite ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <MentionComposer
            value={draft}
            onChange={setDraft}
            members={members}
            placeholder="Escreva o comentário. Use @ para mencionar alguém da equipe."
            autoFocus
          />
          <AttachmentPicker file={draftFile} onChange={setDraftFile} />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowComposer(false);
                setDraft("");
                setDraftFile(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={saving || (!draft.trim() && !draftFile)}
              onClick={() => void createEntry()}
            >
              Salvar comentário
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          {items === null ? (
            <p className="text-sm text-muted">Carregando comentários...</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : !items.length ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
              <p className="text-sm text-muted">
                {query ? "Nenhum comentário encontrado para esta busca." : "Nenhum comentário ainda."}
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
                      const isSelected = selectedId === entry.id;

                      return (
                        <li key={entry.id}>
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedId(entry.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedId(entry.id);
                              }
                            }}
                            className={cn(
                              "w-full cursor-pointer px-4 py-4 text-left transition",
                              isSelected ? "bg-blue-50/70 dark:bg-blue-950/20" : "hover:bg-hover",
                            )}
                          >
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
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setEditingId(entry.id);
                                          setEditDraft(entry.content);
                                          setEditFile(null);
                                          setRemoveEditAttachment(false);
                                          setShowComposer(false);
                                        }}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            event.stopPropagation();
                                          }
                                        }}
                                        className="rounded p-1 text-faint hover:bg-hover hover:text-muted"
                                        title="Editar comentário"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </span>
                                    ) : null}
                                    {canDelete ? (
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void removeEntry(entry);
                                        }}
                                        className="rounded p-1 text-faint hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                        title="Excluir comentário"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div
                                    className="mt-3 space-y-3"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <MentionComposer
                                      value={editDraft}
                                      onChange={setEditDraft}
                                      members={members}
                                      rows={4}
                                    />
                                    {entry.attachmentUrl && !removeEditAttachment && !editFile ? (
                                      <div className="flex items-center gap-2">
                                        <AttachmentBadge
                                          name={entry.attachmentName ?? "Anexo"}
                                          onOpen={() => openAttachmentViewer(entry)}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setRemoveEditAttachment(true)}
                                          className="text-xs text-red-600 dark:text-red-400"
                                        >
                                          Remover anexo
                                        </button>
                                      </div>
                                    ) : null}
                                    <AttachmentPicker file={editFile} onChange={setEditFile} />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingId(null);
                                          setEditDraft("");
                                          setEditFile(null);
                                          setRemoveEditAttachment(false);
                                        }}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        disabled={
                                          saving ||
                                          (!editDraft.trim() &&
                                            !editFile &&
                                            !(entry.attachmentUrl && !removeEditAttachment))
                                        }
                                        onClick={() => void saveEdit(entry)}
                                      >
                                        Salvar
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {entry.content ? (
                                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                                        <HistoryContent content={entry.content} members={members} />
                                      </p>
                                    ) : null}
                                    {entry.attachmentName ? (
                                      <div className="mt-2">
                                        <AttachmentBadge
                                          name={entry.attachmentName}
                                          onOpen={() => openAttachmentViewer(entry)}
                                        />
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
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

        <CommentAttachmentPreview
          entry={selectedEntry}
          className="xl:sticky xl:top-4 xl:self-start"
          onExpand={selectedEntry?.attachmentUrl ? () => setViewerOpen(true) : undefined}
        />
      </div>

      <AttachmentViewerModal
        entry={selectedEntry}
        open={viewerOpen && Boolean(selectedEntry?.attachmentUrl)}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
