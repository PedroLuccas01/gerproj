import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ProjetoHistoricoRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/projetos/${id}/cronograma?comentarios=1`);
}
