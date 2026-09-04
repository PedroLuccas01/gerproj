import { Suspense } from "react";
import { CronogramaPageClient } from "./CronogramaPageClient";

export default function CronogramaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Carregando cronograma...</div>}>
      <CronogramaPageClient />
    </Suspense>
  );
}
