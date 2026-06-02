import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from "recharts";
import { getCycleMonths } from "@/lib/evolution-utils";
import { expectedProgressKR, progressKR, type OKRStatus } from "@/lib/okr-utils";
import type { Tables } from "@/integrations/supabase/types";

type KeyResult = Tables<"key_results"> & { expected_progress_mode?: string };
type Checkin = { id: string; key_result_id: string; value: number; comment?: string | null; created_at: string; reference_month?: string; milestone_id?: string | null };

const STATUS_COLORS: Record<OKRStatus | "no-update", string> = {
  "off-track": "hsl(var(--status-off-track))",
  "at-risk": "hsl(var(--status-at-risk))",
  "on-track": "hsl(var(--status-on-track))",
  completed: "hsl(var(--status-completed))",
  "no-update": "hsl(var(--muted-foreground))",
};

function getStatusFromProgress(progress: number, expected: number): OKRStatus {
  if (progress >= 1) return "completed";
  if (expected === 0) return "on-track";
  if (progress < expected * 0.4) return "off-track";
  if (progress < expected * 0.7) return "at-risk";
  return "on-track";
}

interface Props {
  cycle: Tables<"cycles">;
  keyResults: KeyResult[];
  checkinsMap: Record<string, Checkin[]>;
  milestonesMap: Record<string, Tables<"milestones">[]>;
}

export default function ObjectiveEvolutionCharts({ cycle, keyResults, checkinsMap, milestonesMap }: Props) {
  const { progressData, statusData } = useMemo(() => {
    if (!cycle || !keyResults.length) return { progressData: [], statusData: [] };

    const months = getCycleMonths(cycle);

    // For each KR, compute cumulative progress per month
    const krMonthlyProgress: Record<string, (number | null)[]> = {};

    // Find the global last month index that has ANY checkin across all KRs
    let globalLastCheckinMonthIdx = -1;

    for (const kr of keyResults) {
      const allCheckins = checkinsMap[kr.id] || [];
      const milestones = milestonesMap[kr.id] || [];

      // Assign each checkin a month key
      const checkinWithMonth = allCheckins.map(c => ({
        ...c,
        monthKey: c.reference_month || (() => {
          const d = new Date(c.created_at);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        })(),
      }));

      // Track last month with checkin for this KR
      let krLastCheckinMonthIdx = -1;
      for (let i = 0; i < months.length; i++) {
        if (checkinWithMonth.some(c => c.monthKey === months[i].key)) {
          krLastCheckinMonthIdx = i;
        }
      }
      if (krLastCheckinMonthIdx > globalLastCheckinMonthIdx) {
        globalLastCheckinMonthIdx = krLastCheckinMonthIdx;
      }

      // Build cumulative progress for each month
      // Use string comparison to include ALL checkins up to each month,
      // even those with reference_month outside the cycle months list
      const monthProgress: (number | null)[] = [];

      for (let monthIdx = 0; monthIdx < months.length; monthIdx++) {
        const monthKey = months[monthIdx].key;

        // Include ALL checkins with monthKey <= current month (string compare works for YYYY-MM)
        const checkinsUpToMonth = checkinWithMonth.filter(c => c.monthKey <= monthKey);

        if (checkinsUpToMonth.length === 0) {
          monthProgress.push(null);
          continue;
        }

        if (kr.has_milestones && milestones.length > 0) {
          const virtualMilestones = milestones.map(m => {
            const msAccumulated = checkinsUpToMonth
              .filter(c => c.milestone_id === m.id)
              .reduce((sum, c) => sum + c.value, 0);
            return { ...m, current_value: msAccumulated };
          });
          monthProgress.push(progressKR(kr, virtualMilestones, undefined));
        } else {
          const checkinRecords = checkinsUpToMonth.map(c => ({
            id: c.id,
            key_result_id: c.key_result_id,
            value: c.value,
            milestone_id: c.milestone_id,
          }));
          monthProgress.push(progressKR(kr, undefined, checkinRecords));
        }
      }

      krMonthlyProgress[kr.id] = monthProgress;
    }

    // Carry forward: fill null gaps within the checkin range with last known value
    for (const kr of keyResults) {
      const mp = krMonthlyProgress[kr.id];
      if (!mp) continue;
      let lastKnown: number | null = null;
      for (let i = 0; i < mp.length; i++) {
        if (i > globalLastCheckinMonthIdx) break;
        if (mp[i] !== null) {
          lastKnown = mp[i];
        } else if (lastKnown !== null) {
          mp[i] = lastKnown;
        }
      }
    }

    // Build progress chart data
    const progressData = months.map(({ label }, monthIdx) => {
      if (monthIdx > globalLastCheckinMonthIdx) {
        return { name: label, progress: null };
      }

      const progresses: number[] = [];
      for (const kr of keyResults) {
        const p = krMonthlyProgress[kr.id]?.[monthIdx];
        progresses.push(p !== null && p !== undefined ? p : 0);
      }
      const avg = progresses.length > 0
        ? Math.round((progresses.reduce((a, b) => a + b, 0) / progresses.length) * 100)
        : 0;
      return { name: label, progress: avg };
    });

    // Status chart data
    const statusData = months.map(({ label, endOfMonth }, monthIdx) => {
      if (monthIdx > globalLastCheckinMonthIdx) {
        return { name: label, "off-track": 0, "at-risk": 0, "on-track": 0, completed: 0 };
      }

      const counts = { name: label, "off-track": 0, "at-risk": 0, "on-track": 0, completed: 0 };
      for (const kr of keyResults) {
        const progress = krMonthlyProgress[kr.id]?.[monthIdx] ?? 0;
        const expected = expectedProgressKR(kr, cycle, milestonesMap[kr.id], endOfMonth);
        const status = getStatusFromProgress(progress, expected);
        counts[status]++;
      }
      return counts;
    });

    return { progressData, statusData };
  }, [cycle, keyResults, checkinsMap, milestonesMap]);

  const progressConfig = { progress: { label: "Progresso OKR", color: "hsl(var(--primary))" } };
  const statusConfig = {
    "off-track": { label: "Crítico", color: STATUS_COLORS["off-track"] },
    "at-risk": { label: "Atenção", color: STATUS_COLORS["at-risk"] },
    "on-track": { label: "No planejado", color: STATUS_COLORS["on-track"] },
    completed: { label: "Completo", color: STATUS_COLORS["completed"] },
  };

  if (!progressData.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status dos Key Results por mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusConfig} className="aspect-[3/2] max-h-[220px]">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
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
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS["completed"]} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="completed" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Evolução do OKR por mês (%)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={progressConfig} className="aspect-[3/2] max-h-[220px]">
            <BarChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="progress" position="top" formatter={(v: number) => v != null ? `${v}%` : ""} className="fill-foreground text-[10px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
