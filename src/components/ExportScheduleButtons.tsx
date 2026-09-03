"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { downloadScheduleExcel, downloadSchedulePdf, type ScheduleExportInput } from "@/lib/export-schedule";
import { useFeedback } from "@/lib/feedback";
import { cn } from "./ui";

export function ExportScheduleButtons({
  input,
  compact = false,
}: {
  input: ScheduleExportInput;
  compact?: boolean;
}) {
  const { notify } = useFeedback();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  async function run(kind: "xlsx" | "pdf") {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "xlsx") await downloadScheduleExcel(input);
      else await downloadSchedulePdf(input);
    } catch (error) {
      notify({
        type: "error",
        title: kind === "xlsx" ? "Não foi possível gerar o Excel" : "Não foi possível gerar o PDF",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-1")}>
      <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void run("xlsx")}>
        <FileSpreadsheet className="h-4 w-4" />
        {busy === "xlsx" ? "Gerando..." : compact ? "Excel" : "Excel"}
      </Button>
      <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void run("pdf")}>
        <FileText className="h-4 w-4" />
        {busy === "pdf" ? "Gerando..." : "PDF"}
      </Button>
    </div>
  );
}
