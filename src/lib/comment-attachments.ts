export const COMMENT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const COMMENT_ATTACHMENT_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export type CommentAttachmentInput = {
  url: string;
  pathname: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export function isCommentAttachmentMime(mimeType: string) {
  return ALLOWED_MIME.has(mimeType.toLowerCase());
}

export function validateCommentAttachment(file: Pick<File, "name" | "type" | "size">) {
  const mimeType = file.type.toLowerCase();
  if (!isCommentAttachmentMime(mimeType)) {
    return "Tipo de arquivo não suportado. Use PDF, imagem, Word ou Excel.";
  }
  if (file.size > COMMENT_ATTACHMENT_MAX_BYTES) {
    return "Arquivo muito grande. O limite é 10 MB.";
  }
  return null;
}

export function sanitizeAttachmentName(name: string) {
  return name.replace(/[^\w.\-()+\s]/g, "_").slice(0, 120);
}

export function attachmentExtension(mimeType: string) {
  return EXT_BY_MIME[mimeType.toLowerCase()] ?? "";
}

export function isImageAttachment(mimeType: string | null | undefined) {
  return Boolean(mimeType?.startsWith("image/"));
}

export function isPdfAttachment(mimeType: string | null | undefined) {
  return mimeType === "application/pdf";
}

export function isExcelAttachment(mimeType: string | null | undefined) {
  return (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function isWordAttachment(mimeType: string | null | undefined) {
  return (
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function officeEmbedUrl(fileUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
}

export async function downloadCommentAttachment(url: string, fileName: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "anexo";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
