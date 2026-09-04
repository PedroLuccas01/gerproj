"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Paperclip,
} from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import * as XLSX from "xlsx";
import { Modal } from "@/components/Modal";
import {
  isExcelAttachment,
  isImageAttachment,
  isPdfAttachment,
  isWordAttachment,
  downloadCommentAttachment,
  officeEmbedUrl,
} from "@/lib/comment-attachments";
import type { ProjectHistoryEntry } from "@/lib/types";
import { Button, cn } from "./ui";

type ViewerMode = "compact" | "expanded";

function ImageDownloadButton({
  url,
  fileName,
  className,
}: {
  url: string;
  fileName: string;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadCommentAttachment(url, fileName);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      onClick={handleDownload}
      disabled={downloading}
      className={cn("shrink-0 px-2 py-1 text-xs", className)}
      title="Baixar imagem"
    >
      <Download className="h-3.5 w-3.5" />
      {downloading ? "Baixando..." : "Baixar"}
    </Button>
  );
}

function SheetTabs({
  names,
  active,
  onChange,
}: {
  names: string[];
  active: number;
  onChange: (index: number) => void;
}) {
  if (names.length <= 1) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1 border-b border-line-subtle pb-2">
      {names.map((name, index) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(index)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition",
            index === active
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "text-muted hover:bg-hover",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function ExcelWorkbookPreview({ url, mode }: { url: string; mode: ViewerMode }) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheets, setSheets] = useState<Record<string, string[][]>>({});
  const [activeSheet, setActiveSheet] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setSheetNames([]);
    setSheets({});
    setActiveSheet(0);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a planilha.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const workbook = XLSX.read(buffer, { type: "array" });
        const parsed: Record<string, string[][]> = {};
        const rowLimit = mode === "expanded" ? 200 : 40;
        for (const name of workbook.SheetNames) {
          const sheet = workbook.Sheets[name];
          const data = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
            header: 1,
            defval: "",
          });
          parsed[name] = data.slice(0, rowLimit).map((row) => row.map((cell) => String(cell ?? "")));
        }
        setSheetNames(workbook.SheetNames);
        setSheets(parsed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar a planilha.");
      });
    return () => {
      cancelled = true;
    };
  }, [url, mode]);

  const activeName = sheetNames[activeSheet];
  const rows = activeName ? sheets[activeName] ?? [] : [];

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!rows.length) return <p className="text-sm text-muted">Carregando planilha...</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetTabs names={sheetNames} active={activeSheet} onChange={setActiveSheet} />
      <div
        className={cn(
          "overflow-auto rounded-lg border border-line",
          mode === "expanded" ? "min-h-0 flex-1" : "max-h-[520px]",
        )}
      >
        <table className="min-w-full border-collapse text-left text-xs">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-line-subtle">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="whitespace-nowrap px-2 py-1.5 text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PdfPreview({ url, mode }: { url: string; mode: ViewerMode }) {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
    let cancelled = false;
    import("pdfjs-dist")
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ url }).promise;
        if (!cancelled) setTotalPages(Math.max(1, pdf.numPages));
      })
      .catch(() => {
        if (!cancelled) setTotalPages(1);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className={cn("flex flex-col", mode === "expanded" && "min-h-0 flex-1")}>
      {totalPages > 1 ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="px-2 py-1 text-xs"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-xs text-muted">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="px-2 py-1 text-xs"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <iframe
        title="PDF anexado"
        src={`${url}#page=${page}&toolbar=1&navpanes=0`}
        className="w-full rounded-lg border border-line bg-white"
        style={{ height: mode === "expanded" ? "70vh" : 520 }}
      />
    </div>
  );
}

function ImagePreview({ url, name, mode }: { url: string; name: string; mode: ViewerMode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-auto rounded-lg border border-line bg-surface-2",
        mode === "expanded" ? "min-h-0 flex-1" : "max-h-[520px]",
      )}
    >
      <img
        src={url}
        alt={name}
        className={cn(
          "object-contain",
          mode === "expanded" ? "max-h-[min(75vh,820px)] w-full" : "max-h-[520px] w-full",
        )}
      />
    </div>
  );
}

function WordPreview({ url, mode }: { url: string; mode: ViewerMode }) {
  return (
    <div className={cn("flex flex-col", mode === "expanded" && "min-h-0 flex-1")}>
      <p className="mb-2 text-xs text-faint">
        Use a barra do visualizador para navegar entre as páginas do documento.
      </p>
      <iframe
        title="Documento Word"
        src={officeEmbedUrl(url)}
        className="w-full rounded-lg border border-line bg-white"
        style={{ height: mode === "expanded" ? "70vh" : 520 }}
      />
    </div>
  );
}

export function AttachmentViewerContent({
  entry,
  mode,
}: {
  entry: ProjectHistoryEntry;
  mode: ViewerMode;
}) {
  const url = entry.attachmentUrl;
  const mime = entry.attachmentMime;
  if (!url || !mime) return null;

  if (isImageAttachment(mime)) {
    return <ImagePreview url={url} name={entry.attachmentName ?? "Imagem"} mode={mode} />;
  }
  if (isPdfAttachment(mime)) {
    return <PdfPreview url={url} mode={mode} />;
  }
  if (isExcelAttachment(mime)) {
    return <ExcelWorkbookPreview url={url} mode={mode} />;
  }
  if (isWordAttachment(mime)) {
    return <WordPreview url={url} mode={mode} />;
  }

  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      Pré-visualização não disponível para este tipo de arquivo.
    </div>
  );
}

export function AttachmentViewerModal({
  entry,
  open,
  onClose,
}: {
  entry: ProjectHistoryEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!entry?.attachmentUrl) return null;

  const isImage = isImageAttachment(entry.attachmentMime);
  const fileName = entry.attachmentName ?? "Imagem";

  return (
    <Modal
      open={open}
      onClose={onClose}
      xl
      title={entry.attachmentName ?? "Anexo"}
      subtitle={`${entry.authorName} · comentário do projeto`}
      footer={
        isImage ? (
          <ImageDownloadButton url={entry.attachmentUrl} fileName={fileName} />
        ) : undefined
      }
    >
      <AttachmentViewerContent entry={entry} mode="expanded" />
    </Modal>
  );
}

export function CommentAttachmentPreview({
  entry,
  className,
  onExpand,
}: {
  entry: ProjectHistoryEntry | null;
  className?: string;
  onExpand?: () => void;
}) {
  if (!entry?.attachmentUrl) {
    return (
      <div
        className={cn(
          "flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center",
          className,
        )}
      >
        <Paperclip className="mb-3 h-8 w-8 text-faint" />
        <p className="text-sm font-medium text-muted">Pré-visualização</p>
        <p className="mt-1 text-xs text-faint">
          Selecione um comentário com anexo para visualizar aqui.
        </p>
      </div>
    );
  }

  const mime = entry.attachmentMime;
  const isImage = isImageAttachment(mime);
  const Icon = isImage
    ? ImageIcon
    : isExcelAttachment(mime)
      ? FileSpreadsheet
      : FileText;

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <div className="mb-3 flex items-start gap-2 border-b border-line-subtle pb-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{entry.attachmentName}</p>
          <p className="text-xs text-faint">{entry.authorName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isImage ? (
            <ImageDownloadButton
              url={entry.attachmentUrl}
              fileName={entry.attachmentName ?? "Imagem"}
            />
          ) : null}
          {onExpand ? (
            <Button variant="secondary" onClick={onExpand} className="px-2 py-1 text-xs">
              <Expand className="h-3.5 w-3.5" />
              Ampliar
            </Button>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onExpand}
        className={cn("w-full text-left", onExpand ? "cursor-zoom-in" : "cursor-default")}
        title={onExpand ? "Clique para ampliar" : undefined}
      >
        <AttachmentViewerContent entry={entry} mode="compact" />
      </button>
    </div>
  );
}

export function AttachmentBadge({
  name,
  onOpen,
}: {
  name: string;
  onOpen?: () => void;
}) {
  const className =
    "inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted transition hover:bg-hover hover:text-ink";

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={className} title="Abrir anexo">
        <Paperclip className="h-3 w-3" />
        {name}
      </button>
    );
  }

  return (
    <span className={className}>
      <Paperclip className="h-3 w-3" />
      {name}
    </span>
  );
}
