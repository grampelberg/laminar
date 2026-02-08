import { cva } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";

const levels = ["trace", "debug", "info", "warn", "error", "off"] as const;

const levelBadgeVariants = cva(
  ["uppercase", "text-xxs", "font-semibold", "tracking-wider", "w-full"],
  {
    variants: {
      level: {
        trace: [
          "bg-fill-level-trace",
          "border-stroke-level-trace",
          "text-text-level-trace",
        ],
        debug: [
          "bg-fill-level-debug",
          "border-stroke-level-debug",
          "text-text-level-debug",
        ],
        info: [
          "bg-fill-level-info",
          "border-stroke-level-info",
          "text-text-level-info",
        ],
        warn: [
          "bg-fill-level-warn",
          "border-stroke-level-warn",
          "text-text-level-warn",
        ],
        error: [
          "bg-fill-level-error",
          "border-stroke-level-error",
          "text-text-level-error",
        ],
        off: [
          "bg-fill-level-off",
          "border-stroke-level-off",
          "text-text-level-off",
        ],
      },
    },
  },
);

export function LevelBadge({ level }: { level: number }) {
  const name = levels[level];
  return <Badge className={levelBadgeVariants({ level: name })}>{name}</Badge>;
}
