"use client";

import { FileSpreadsheet, FileText, ImageIcon, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  isExcelAttachment,
  isImageAttachment,
  isPdfAttachment,
  isWordAttachment,
  officeEmbedUrl,
} from "@/lib/comment-attachments";
import type { ProjectHistoryEntry } from "@/lib/types";
import { cn } from "./ui";

function ExcelPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setRows([]);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a planilha.");
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          defval: "",
        });
        setRows(
          data.slice(0, 40).map((row) => row.map((cell) => String(cell ?? ""))),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar a planilha.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!rows.length) return <p className="text-sm text-muted">Carregando planilha...</p>;

  return (
    <div className="max-h-[520px] overflow-auto rounded-lg border border-line">
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
  );
}

function PreviewBody({ entry }: { entry: ProjectHistoryEntry }) {
  const url = entry.attachmentUrl;
  const mime = entry.attachmentMime;
  if (!url || !mime) return null;

  if (isImageAttachment(mime)) {
    return (
      <img
        src={url}
        alt={entry.attachmentName ?? "Imagem anexada"}
        className="max-h-[520px] w-full rounded-lg border border-line object-contain"
      />
    );
  }

  if (isPdfAttachment(mime)) {
    return (
      <iframe
        title={entry.attachmentName ?? "PDF anexado"}
        src={url}
        className="h-[520px] w-full rounded-lg border border-line bg-white"
      />
    );
  }

  if (isExcelAttachment(mime)) {
    return <ExcelPreview url={url} />;
  }

  if (isWordAttachment(mime)) {
    return (
      <iframe
        title={entry.attachmentName ?? "Documento Word"}
        src={officeEmbedUrl(url)}
        className="h-[520px] w-full rounded-lg border border-line bg-white"
      />
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      Pré-visualização não disponível para este tipo de arquivo.
    </div>
  );
}

export function CommentAttachmentPreview({
  entry,
  className,
}: {
  entry: ProjectHistoryEntry | null;
  className?: string;
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
  const Icon = isImageAttachment(mime)
    ? ImageIcon
    : isExcelAttachment(mime)
      ? FileSpreadsheet
      : FileText;

  return (
    <div className={cn("rounded-xl border border-line bg-surface p-4", className)}>
      <div className="mb-3 flex items-start gap-2 border-b border-line-subtle pb-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{entry.attachmentName}</p>
          <p className="text-xs text-faint">{entry.authorName}</p>
        </div>
      </div>
      <PreviewBody entry={entry} />
    </div>
  );
}

export function AttachmentBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
      <Paperclip className="h-3 w-3" />
      {name}
    </span>
  );
}
