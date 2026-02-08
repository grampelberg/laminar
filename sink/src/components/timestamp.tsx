import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const fullFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.345, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

function formatRelative(date: Date): string {
  let duration = (date.getTime() - Date.now()) / 1000;

  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }

  return fullFormatter.format(date);
}

export function Timestamp({
  ms,
  relative = false,
}: { ms: number; relative?: boolean }) {
  if (!Number.isFinite(ms)) {
    return <span>-</span>;
  }

  const date = new Date(ms);

  if (!relative) {
    return <span>{fullFormatter.format(date)}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{formatRelative(date)}</span>
      </TooltipTrigger>
      <TooltipContent>{fullFormatter.format(date)}</TooltipContent>
    </Tooltip>
  );
}
