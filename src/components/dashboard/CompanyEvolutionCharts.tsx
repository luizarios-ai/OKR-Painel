import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { getCycleMonths, buildMonthlyEvolution, type MonthBucket } from "@/lib/evolution-utils";
import type { Tables } from "@/integrations/supabase/types";
import type { OKRStatus } from "@/lib/okr-utils";

type KeyResult = Tables<"key_results"> & { expected_progress_mode?: string };
type Checkin = { id: string; key_result_id: string; value: number; comment: string | null; created_at: string; reference_month?: string };
type Objective = Tables<"objectives">;

const STATUS_COLORS: Record<OKRStatus | "no-update", string> = {
  "off-track": "hsl(var(--status-off-track))",
  "at-risk": "hsl(var(--status-at-risk))",
  "on-track": "hsl(var(--status-on-track))",
  completed: "hsl(var(--status-completed))",
  "no-update": "hsl(var(--muted-foreground))",
};

interface Props {
  cycle: Tables<"cycles">;
  objectives: Objective[];
  keyResults: KeyResult[];
  checkins: Checkin[];
  milestonesMap: Record<string, Tables<"milestones">[]>;
}

function getStatusFromProgress(progress: number, expected: number): OKRStatus | "no-update" {
  if (progress >= 1) return "completed";
  if (expected === 0) return "on-track";
  if (progress < expected * 0.4) return "off-track";
  if (progress < expected * 0.7) return "at-risk";
  return "on-track";
}

export default function CompanyEvolutionCharts({ cycle, objectives, keyResults, checkins, milestonesMap }: Props) {
  const checkinsMap = useMemo(() => {
    const map: Record<string, Checkin[]> = {};
    for (const c of checkins) {
      if (!map[c.key_result_id]) map[c.key_result_id] = [];
      map[c.key_result_id].push(c);
    }
    return map;
  }, [checkins]);

  // Group KRs by objective
  const krsByObjective = useMemo(() => {
    const map: Record<string, KeyResult[]> = {};
    for (const kr of keyResults) {
      if (!map[kr.objective_id]) map[kr.objective_id] = [];
      map[kr.objective_id].push(kr);
    }
    return map;
  }, [keyResults]);

  const { progressData, statusData } = useMemo(() => {
    if (!cycle || !objectives.length || !keyResults.length) return { progressData: [], statusData: [] };

    const months = getCycleMonths(cycle);

    // Build KR-level evolutions
    const krEvolutions: Record<string, MonthBucket[]> = {};
    for (const kr of keyResults) {
      krEvolutions[kr.id] = buildMonthlyEvolution(kr, cycle, checkinsMap[kr.id] || [], milestonesMap[kr.id]);
    }

    // For each objective, compute monthly progress as avg of its KRs' progress
    const objEvolutions = objectives.map((obj) => {
      const objKRs = krsByObjective[obj.id] || [];
      const monthlyData = months.map((_, monthIdx) => {
        const krProgresses: number[] = [];
        for (const kr of objKRs) {
          const bucket = krEvolutions[kr.id]?.[monthIdx];
          if (bucket && bucket.progress != null) {
            krProgresses.push(bucket.progress);
          }
        }
        if (krProgresses.length === 0) return { progress: null as number | null, expected: 0 };
        const avgProgress = krProgresses.reduce((a, b) => a + b, 0) / krProgresses.length;
        const expected = krEvolutions[objKRs[0]?.id]?.[monthIdx]?.expected ?? 0;
        return { progress: avgProgress, expected };
      });
      return { objId: obj.id, monthlyData };
    });

    const progressData = months.map(({ label }, monthIdx) => {
      const progresses: number[] = [];
      for (const { monthlyData } of objEvolutions) {
        const d = monthlyData[monthIdx];
        if (d && d.progress != null) progresses.push(d.progress);
      }
      const avg = progresses.length > 0 ? Math.round((progresses.reduce((a, b) => a + b, 0) / progresses.length) * 100) : null;
      return { name: label, progress: avg };
    });

    const statusData = months.map(({ label }, monthIdx) => {
      const counts = { name: label, "off-track": 0, "at-risk": 0, "on-track": 0, completed: 0, "no-update": 0 };
      for (const { monthlyData } of objEvolutions) {
        const d = monthlyData[monthIdx];
        if (d && d.progress != null) {
          const status = getStatusFromProgress(d.progress, d.expected);
          counts[status]++;
        } else {
          counts["no-update"]++;
        }
      }
      return counts;
    });

    return { progressData, statusData };
  }, [cycle, objectives, keyResults, checkinsMap, milestonesMap, krsByObjective]);

  const progressConfig = { progress: { label: "Progresso médio", color: "hsl(var(--primary))" } };

  const statusConfig = {
    "off-track": { label: "Crítico", color: STATUS_COLORS["off-track"] },
    "at-risk": { label: "Atenção", color: STATUS_COLORS["at-risk"] },
    "on-track": { label: "No planejado", color: STATUS_COLORS["on-track"] },
    completed: { label: "Completo", color: STATUS_COLORS["completed"] },
    "no-update": { label: "Sem atualização", color: STATUS_COLORS["no-update"] },
  };

  if (!progressData.length) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Evolução mensal dos OKRs
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Progresso médio dos OKRs mês a mês ao longo do ciclo</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={progressConfig} className="aspect-[2/1] max-h-[300px]">
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="progress" position="top" formatter={(v: number) => v != null ? `${v}%` : ""} className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Status dos OKRs por mês
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Distribuição dos OKRs por status (Crítico, Atenção, No planejado, Completo) em cada mês do ciclo</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusConfig} className="aspect-[2/1] max-h-[300px]">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="off-track" stackId="a" fill={STATUS_COLORS["off-track"]}>
                <LabelList dataKey="off-track" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
              <Bar dataKey="at-risk" stackId="a" fill={STATUS_COLORS["at-risk"]}>
                <LabelList dataKey="at-risk" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
              <Bar dataKey="on-track" stackId="a" fill={STATUS_COLORS["on-track"]}>
                <LabelList dataKey="on-track" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS["completed"]}>
                <LabelList dataKey="completed" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
              <Bar dataKey="no-update" stackId="a" fill={STATUS_COLORS["no-update"]} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="no-update" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}
