import { cn } from "@/lib/utils";

/** The "Sameer" assistant mascot — a chunky retro smiley. */
export function Smiley({
  className,
  fill = "var(--color-sunshine)",
}: {
  className?: string;
  fill?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-12 w-12", className)} aria-hidden>
      <circle
        cx={50}
        cy={50}
        r={45}
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={5}
      />
      <circle cx={36} cy={40} r={6} fill="var(--color-ink)" />
      <circle cx={64} cy={40} r={6} fill="var(--color-ink)" />
      <path
        d="M30 58 Q50 80 70 58"
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth={6}
        strokeLinecap="round"
      />
    </svg>
  );
}
