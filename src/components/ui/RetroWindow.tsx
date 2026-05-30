import { motion } from "framer-motion";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RetroWindowProps = {
  title: string;
  titleBarColor?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** small icon shown left of the title */
  icon?: ReactNode;
  animate?: boolean;
};

/**
 * Retro browser-style window: a colored title bar with three traffic-light
 * dots, sitting on a white body. The signature content container.
 */
export function RetroWindow({
  title,
  titleBarColor = "bg-blush",
  children,
  className,
  bodyClassName,
  icon,
  animate = true,
}: RetroWindowProps) {
  const Wrapper = animate ? motion.div : "div";
  const motionProps = animate
    ? {
        initial: { y: 16, opacity: 0, scale: 0.98 },
        animate: { y: 0, opacity: 1, scale: 1 },
        transition: { type: "spring" as const, stiffness: 260, damping: 20 },
      }
    : {};

  return (
    <Wrapper className={cn("sticker overflow-hidden bg-white", className)} {...motionProps}>
      {/* Title bar */}
      <div
        className={cn(
          "flex items-center gap-3 border-b-[3px] border-ink px-3 py-2",
          titleBarColor,
        )}
      >
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-tomato" />
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-sunshine" />
          <span className="h-3 w-3 rounded-full border-2 border-ink bg-mint" />
        </div>
        {icon}
        <span className="window-title truncate">{title}</span>
      </div>
      {/* Body */}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </Wrapper>
  );
}
