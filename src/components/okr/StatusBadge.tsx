import type { OKRStatus } from "@/lib/okr-utils";
import { statusLabel } from "@/lib/okr-utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const styles: Record<OKRStatus, string> = {
  "off-track": "bg-status-off-track-bg text-status-off-track",
  "at-risk": "bg-status-at-risk-bg text-status-at-risk",
  "on-track": "bg-status-on-track-bg text-status-on-track",
  completed: "bg-status-completed-bg text-status-completed",
};

const legends: Record<OKRStatus, string> = {
  "off-track": "Progresso abaixo de 40% do esperado para o período",
  "at-risk": "Progresso entre 40% e 70% do esperado para o período",
  "on-track": "Progresso acima de 70% do esperado para o período",
  completed: "Meta atingida ou superada",
};

export default function StatusBadge({ status }: { status: OKRStatus }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-help ${styles[status]}`}>
            <span className={`h-1.5 w-1.5 rounded-full bg-current`} />
            {statusLabel(status)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">
          <p className="text-xs">{legends[status]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
