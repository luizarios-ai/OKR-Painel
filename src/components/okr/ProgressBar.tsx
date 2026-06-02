import type { OKRStatus } from "@/lib/okr-utils";

const barColors: Record<OKRStatus, string> = {
  "off-track": "bg-status-off-track",
  "at-risk": "bg-status-at-risk",
  "on-track": "bg-status-on-track",
  completed: "bg-status-completed",
};

interface Props {
  progress: number;
  status: OKRStatus;
  expected?: number;
  className?: string;
}

export default function ProgressBar({ progress, status, expected, className = "" }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <div className={`relative ${className}`}>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[status]}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {expected != null && (
        <div
          className="absolute top-0 h-2 w-0.5 bg-foreground/30"
          style={{ left: `${Math.min(Math.round(expected * 100), 100)}%` }}
          title={`Esperado: ${Math.round(expected * 100)}%`}
        />
      )}
    </div>
  );
}
