import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { assertCanWriteProjectHistory } from "@/lib/access";
import { handleApiError, jsonError } from "@/lib/api-utils";
import {
  sanitizeAttachmentName,
  validateCommentAttachment,
} from "@/lib/comment-attachments";
import { requireAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const access = await requireAccess();
    const { id: projectId } = await params;
    await assertCanWriteProjectHistory(access, projectId);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione um arquivo.");

    const validationError = validateCommentAttachment(file);
    if (validationError) return jsonError(validationError);

    const safeName = sanitizeAttachmentName(file.name || "arquivo");
    const pathname = `projects/${projectId}/comments/${crypto.randomUUID()}-${safeName}`;
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
