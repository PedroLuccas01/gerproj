"use client";

import { useParams } from "next/navigation";
import { ShareCronogramaView } from "@/components/ShareCronogramaView";

export default function ShareCronogramaPage() {
  const params = useParams<{ token: string }>();
  return <ShareCronogramaView token={params.token} />;
}
