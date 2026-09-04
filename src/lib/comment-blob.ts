import { del } from "@vercel/blob";
import type { CommentAttachmentInput } from "./comment-attachments";

export async function deleteCommentAttachment(pathname: string | null | undefined) {
  if (!pathname) return;
  try {
    await del(pathname);
  } catch {
    /* blob may already be gone */
  }
}

export function attachmentDataFromInput(attachment?: CommentAttachmentInput | null) {
  if (!attachment?.url || !attachment.pathname) return null;
  return {
    attachmentUrl: attachment.url,
    attachmentPathname: attachment.pathname,
    attachmentName: attachment.fileName,
    attachmentMime: attachment.mimeType,
    attachmentSize: attachment.size,
  };
}

export function clearAttachmentData() {
  return {
    attachmentUrl: null,
    attachmentPathname: null,
    attachmentName: null,
    attachmentMime: null,
    attachmentSize: null,
  };
}
