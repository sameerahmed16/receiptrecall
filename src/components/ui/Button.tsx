import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "pink" | "mint" | "lilac" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-electric text-white",
  pink: "bg-hotpink text-white",
  mint: "bg-mint text-ink",
  lilac: "bg-lilac text-ink",
  ghost: "bg-white text-ink",
};

type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: Variant;
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={cn(
        "sticker-sm press inline-flex items-center justify-center gap-2",
        "px-5 py-2.5 font-display text-base font-bold uppercase tracking-wide",
        "cursor-pointer select-none disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
