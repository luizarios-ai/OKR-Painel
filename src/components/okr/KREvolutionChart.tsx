import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildMonthlyEvolution } from "@/lib/evolution-utils";
import { formatPercent, formatValue, statusLabel, type OKRStatus } from "@/lib/okr-utils";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_COLORS: Record<OKRStatus | "no-update", string> = {
  "off-track": "hsl(var(--status-off-track))",
  "at-risk": "hsl(var(--status-at-risk))",
  "on-track": "hsl(var(--status-on-track))",
  completed: "hsl(var(--status-completed))",
  "no-update": "hsl(var(--muted-foreground))",
};

interface Props {
  kr: Tables<"key_results"> & { expected_progress_mode?: string };
  cycle: Tables<"cycles">;
  checkins: any[];
  milestones?: Tables<"milestones">[];
}

export default function KREvolutionChart({ kr, cycle, checkins, milestones }: Props) {
  const evolution = useMemo(
    () => buildMonthlyEvolution(kr, cycle, checkins || [], milestones),
    [kr, cycle, checkins, milestones]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acompanhamento mensal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Mês</th>
                <th className="pb-2 pr-4 font-medium">Valor</th>
                <th className="pb-2 pr-4 font-medium">Progresso</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Comentário</th>
              </tr>
            </thead>
            <tbody>
              {evolution.map((m) => (
                <tr key={m.key} className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium">{m.label}</td>
                  <td className="py-2 pr-4">{m.value != null ? formatValue(m.value, kr.unit) : "—"}</td>
                  <td className="py-2 pr-4">{m.progress != null ? formatPercent(m.progress) : "—"}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ color: STATUS_COLORS[m.status], backgroundColor: `${STATUS_COLORS[m.status]}15` }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[m.status] }} />
                      {m.status === "no-update" ? "Sem atualização" : statusLabel(m.status)}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground truncate max-w-[200px]">{m.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
