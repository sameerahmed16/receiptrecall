import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ShapeProps = {
  className?: string;
  fill?: string;
};

/** 4-point twinkle sparkle. */
export function Sparkle({ className, fill = "var(--color-sunshine)" }: ShapeProps) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-8 w-8", className)} aria-hidden>
      <path
        d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z"
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Twinkling animated sparkle wrapper. */
export function TwinkleSparkle({
  className,
  fill,
  delay = 0,
}: ShapeProps & { delay?: number }) {
  return (
    <motion.div
      className={cn("pointer-events-none absolute", className)}
      initial={{ scale: 0.6, rotate: 0, opacity: 0.7 }}
      animate={{ scale: [0.6, 1, 0.6], rotate: [0, 25, 0], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 3, repeat: Infinity, delay, ease: "easeInOut" }}
    >
      <Sparkle fill={fill} className="h-full w-full" />
    </motion.div>
  );
}

/** Chunky 12-point starburst. */
export function Starburst({ className, fill = "var(--color-tomato)" }: ShapeProps) {
  const points: string[] = [];
  const spikes = 12;
  const cx = 50;
  const cy = 50;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? 48 : 26;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return (
    <svg viewBox="0 0 100 100" className={cn("h-12 w-12", className)} aria-hidden>
      <polygon
        points={points.join(" ")}
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Puffy outlined cloud. */
export function Cloud({ className, fill = "#ffffff" }: ShapeProps) {
  return (
    <svg viewBox="0 0 120 70" className={cn("h-12 w-20", className)} aria-hidden>
      <path
        d="M30 60 a22 22 0 0 1 2 -44 a26 26 0 0 1 50 4 a20 20 0 0 1 4 40 Z"
        fill={fill}
        stroke="var(--color-ink)"
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
