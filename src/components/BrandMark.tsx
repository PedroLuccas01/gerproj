import { cn } from "./ui";

export function BrandMark({
  className,
  inverted = false,
  onLight = false,
  size = "md",
}: {
  className?: string;
  inverted?: boolean;
  onLight?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <div className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span
        className={cn(
          "font-capsula tracking-[0.08em] text-ink",
          size === "lg" ? "text-[18px]" : "text-[13px]",
          inverted && "text-white",
          onLight && "text-slate-900",
        )}
      >
        CAPSULA
      </span>
      <span
        className={cn(
          "font-slogan text-muted",
          size === "lg" ? "mt-2 text-[13px]" : "mt-1.5 text-[11px]",
          inverted && "text-white/75",
          onLight && "text-slate-500",
        )}
      >
        Tecnologia
      </span>
    </div>
  );
}
