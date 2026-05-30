import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A pastel sticker card with the hard offset shadow. */
export function Card({
  children,
  className,
  color = "bg-white",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div className={cn("sticker p-5", color, className)}>{children}</div>
  );
}
