"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export function ProjectSubnav({
  projectId,
  isManagement,
}: {
  projectId: string;
  isManagement: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    ...(isManagement
      ? [{ href: `/projetos/${projectId}`, label: "Detalhes", match: (path: string) => path === `/projetos/${projectId}` }]
      : []),
    {
      href: `/projetos/${projectId}/cronograma`,
      label: "Cronograma",
      match: (path: string) => path.endsWith("/cronograma"),
    },
    {
      href: `/projetos/${projectId}/comentarios`,
      label: "Comentários",
      match: (path: string) => path.endsWith("/comentarios") || path.endsWith("/historico"),
    },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-line-subtle pb-3">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
