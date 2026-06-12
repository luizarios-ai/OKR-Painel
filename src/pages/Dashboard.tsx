import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useObjectives, useKeyResults, useMilestones, useAreas, useAllCheckins } from "@/hooks/useOKRData";
import { progressKR, progressObjective, getKRStatus, expectedProgress, statusOrder, formatPercent, type OKRStatus } from "@/lib/okr-utils";
import StatusBadge from "@/components/okr/StatusBadge";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPDF } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, TrendingDown, AlertTriangle, CheckCircle2, Activity, Info } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from "recharts";
import DashboardFilters, { loadFilters, type FilterState } from "@/components/dashboard/DashboardFilters";
import AIAreaSummary from "@/components/okr/AIAreaSummary";

const ROW_HEIGHT = 49;
const MAX_VISIBLE = 7;

const STATUS_COLORS: Record<OKRStatus, string> = {
  "off-track": "hsl(var(--status-off-track))",
  "at-risk": "hsl(var(--status-at-risk))",
  "on-track": "hsl(var(--status-on-track))",
  completed: "hsl(var(--status-completed))",
};

export default function Dashboard() {
  const { currentCycle, setCycle, cycles } = useApp();
  const { data: objectives } = useObjectives(currentCycle?.id);
  const { data: keyResults } = useKeyResults(currentCycle?.id);
  const { data: areas } = useAreas();
  const krIds = useMemo(() => (keyResults || []).filter((kr) => kr.has_milestones).map((kr) => kr.id), [keyResults]);
  const allKrIds = useMemo(() => (keyResults || []).map((kr) => kr.id), [keyResults]);
  const { data: milestones } = useMilestones(krIds);
  const { data: allCheckins } = useAllCheckins(currentCycle?.id, allKrIds);

  const [filters, setFilters] = useState<FilterState>(loadFilters);

  const milestonesMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (milestones || []).forEach((m) => {
      if (!map[m.key_result_id]) map[m.key_result_id] = [];
      map[m.key_result_id].push(m);
    });
    return map;
  }, [milestones]);

  const checkinsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (allCheckins || []).forEach((c: any) => {
      if (!map[c.key_result_id]) map[c.key_result_id] = [];
      map[c.key_result_id].push(c);
    });
    return map;
  }, [allCheckins]);

  // Build a set of area_ids that match filter
  const filteredAreaIds = useMemo(() => {
    if (!filters.areaIds.length) return null; // null = no filter
    return new Set(filters.areaIds);
  }, [filters.areaIds]);

  // Filtered KRs (by area + status)
  const filteredKRs = useMemo(() => {
    if (!keyResults || !currentCycle) return [];
    let krs = keyResults;
    if (filteredAreaIds) {
      krs = krs.filter((kr: any) => kr.area_id && filteredAreaIds.has(kr.area_id));
    }
    if (filters.statuses.length > 0) {
      const statusSet = new Set(filters.statuses);
      krs = krs.filter((kr) => statusSet.has(getKRStatus(kr, currentCycle, milestonesMap[kr.id], checkinsMap[kr.id])));
    }
    return krs;
  }, [keyResults, currentCycle, filteredAreaIds, filters.statuses, milestonesMap, checkinsMap]);

  const stats = useMemo(() => {
    if (!currentCycle) return { total: 0, offTrack: 0, atRisk: 0, onTrack: 0, completed: 0, avgProgress: 0 };
    const statuses = filteredKRs.map((kr) => getKRStatus(kr, currentCycle, milestonesMap[kr.id], checkinsMap[kr.id]));
    const progresses = filteredKRs.map((kr) => progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]));
    return {
      total: filteredKRs.length,
      offTrack: statuses.filter((s) => s === "off-track").length,
      atRisk: statuses.filter((s) => s === "at-risk").length,
      onTrack: statuses.filter((s) => s === "on-track").length,
      completed: statuses.filter((s) => s === "completed").length,
      avgProgress: progresses.length > 0 ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0,
    };
  }, [filteredKRs, currentCycle, milestonesMap, checkinsMap]);


  // Filtered objectives for area chart
  const filteredObjectives = useMemo(() => {
    if (!objectives) return [];
    if (!filteredAreaIds) return objectives;
    return objectives.filter((obj: any) => obj.area_id && filteredAreaIds.has(obj.area_id));
  }, [objectives, filteredAreaIds]);

  // Helper: get area name for an area_id
  const getAreaName = useMemo(() => {
    const areaMap: Record<string, string> = {};
    (areas || []).forEach((a) => { areaMap[a.id] = a.name; });
    return (areaId: string | null) => (areaId && areaMap[areaId]) || "—";
  }, [areas]);

  const areaProgressData = useMemo(() => {
    if (!filteredObjectives.length || !filteredKRs.length || !areas) return [];
    const areaMap: Record<string, { name: string; objectives: string[] }> = {};
    (areas || []).forEach((a) => { areaMap[a.id] = { name: a.name, objectives: [] }; });

    filteredObjectives.forEach((obj: any) => {
      if (obj.area_id && areaMap[obj.area_id]) {
        areaMap[obj.area_id].objectives.push(obj.id);
      }
    });

    return Object.entries(areaMap)
      .map(([id, a]) => {
        if (filteredAreaIds && !filteredAreaIds.has(id)) return null;
        const objKRs = a.objectives.map((objId) => {
          const krs = filteredKRs.filter((kr) => kr.objective_id === objId);
          return progressObjective(krs, milestonesMap, checkinsMap);
        });
        const avg = objKRs.length > 0 ? objKRs.reduce((s, v) => s + v, 0) / objKRs.length : 0;
        return { name: a.name, progress: Math.round(avg * 100) };
      })
      .filter((x): x is { name: string; progress: number } => x !== null && x.progress > 0 || x !== null)
      .sort((a, b) => b.progress - a.progress);
  }, [filteredObjectives, filteredKRs, areas, milestonesMap, filteredAreaIds, checkinsMap]);

  const statusByAreaData = useMemo(() => {
    if (!filteredKRs.length || !currentCycle || !areas) return [];
    const areaMap: Record<string, { name: string; "off-track": number; "at-risk": number; "on-track": number; completed: number }> = {};
    const relevantAreas = filteredAreaIds
      ? (areas || []).filter((a) => filteredAreaIds.has(a.id))
      : (areas || []);
    relevantAreas.forEach((a) => { areaMap[a.id] = { name: a.name, "off-track": 0, "at-risk": 0, "on-track": 0, completed: 0 }; });

    filteredKRs.forEach((kr: any) => {
      if (kr.area_id && areaMap[kr.area_id]) {
        const status = getKRStatus(kr, currentCycle, milestonesMap[kr.id], checkinsMap[kr.id]);
        areaMap[kr.area_id][status]++;
      }
    });

    return Object.values(areaMap);
  }, [filteredKRs, currentCycle, areas, milestonesMap, filteredAreaIds, checkinsMap]);

  // KRs Críticos e em Atenção
  const topOffTrackKRs = useMemo(() => {
    if (!currentCycle || !objectives) return [];
    const objMap: Record<string, any> = {};
    (objectives || []).forEach((o: any) => { objMap[o.id] = o; });

    return filteredKRs
      .map((kr: any) => {
        const status = getKRStatus(kr, currentCycle, milestonesMap[kr.id], checkinsMap[kr.id]);
        const progress = progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]);
        const obj = objMap[kr.objective_id];
        return { kr, status, progress, objective: obj };
      })
      .filter((x) => x.status === "off-track" || x.status === "at-risk")
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.progress - b.progress);
  }, [filteredKRs, currentCycle, milestonesMap, objectives, checkinsMap]);

  // OKRs Críticos e em Atenção
  const topOffTrackOKRs = useMemo(() => {
    if (!currentCycle || !filteredObjectives.length || !filteredKRs.length) return [];

    return filteredObjectives
      .map((obj: any) => {
        const objKRs = filteredKRs.filter((kr) => kr.objective_id === obj.id);
        const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
        const expected = expectedProgress(currentCycle);
        let status: OKRStatus;
        if (objProgress >= 1) status = "completed";
        else if (objProgress < expected * 0.4) status = "off-track";
        else if (objProgress < expected * 0.7) status = "at-risk";
        else status = "on-track";
        return { obj, status, progress: objProgress };
      })
      .filter((x) => x.status === "off-track" || x.status === "at-risk")
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.progress - b.progress);
  }, [filteredObjectives, filteredKRs, currentCycle, milestonesMap, checkinsMap]);

  // OKRs No Planejado e Completos
  const onTrackAndCompletedOKRs = useMemo(() => {
    if (!currentCycle || !filteredObjectives.length || !filteredKRs.length) return [];

    return filteredObjectives
      .map((obj: any) => {
        const objKRs = filteredKRs.filter((kr) => kr.objective_id === obj.id);
        const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
        const expected = expectedProgress(currentCycle);
        let status: OKRStatus;
        if (objProgress >= 1) status = "completed";
        else if (objProgress < expected * 0.4) status = "off-track";
        else if (objProgress < expected * 0.7) status = "at-risk";
        else status = "on-track";
        return { obj, status, progress: objProgress };
      })
      .filter((x) => x.status === "on-track" || x.status === "completed")
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || b.progress - a.progress);
  }, [filteredObjectives, filteredKRs, currentCycle, milestonesMap, checkinsMap]);

  const expected = currentCycle ? expectedProgress(currentCycle) : 0;

  // OKR-level stats
  const okrStats = useMemo(() => {
    if (!currentCycle || !filteredObjectives.length || !filteredKRs.length)
      return { total: 0, offTrack: 0, atRisk: 0, onTrack: 0, completed: 0, avgProgress: 0 };
    const results = filteredObjectives.map((obj: any) => {
      const objKRs = filteredKRs.filter((kr) => kr.objective_id === obj.id);
      const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
      const exp = expectedProgress(currentCycle);
      let status: OKRStatus;
      if (objProgress >= 1) status = "completed";
      else if (objProgress < exp * 0.4) status = "off-track";
      else if (objProgress < exp * 0.7) status = "at-risk";
      else status = "on-track";
      return { status, progress: objProgress };
    });
    const progresses = results.map((r) => r.progress);
    return {
      total: results.length,
      offTrack: results.filter((r) => r.status === "off-track").length,
      atRisk: results.filter((r) => r.status === "at-risk").length,
      onTrack: results.filter((r) => r.status === "on-track").length,
      completed: results.filter((r) => r.status === "completed").length,
      avgProgress: progresses.length > 0 ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0,
    };
  }, [filteredObjectives, filteredKRs, currentCycle, milestonesMap, checkinsMap]);

  const barChartConfig = {
    "off-track": { label: "Crítico", color: "hsl(var(--status-off-track))" },
    "at-risk": { label: "Atenção", color: "hsl(var(--status-at-risk))" },
    "on-track": { label: "No planejado", color: "hsl(var(--status-on-track))" },
    completed: { label: "Completo", color: "hsl(var(--status-completed))" },
  };

  const colChartConfig = {
    progress: { label: "Progresso", color: "hsl(var(--primary))" },
  };

  const TABLE_MAX_H = ROW_HEIGHT * MAX_VISIBLE;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ciclo {currentCycle?.name} · Progresso esperado: {formatPercent(expected)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={currentCycle?.id || ""} onValueChange={(v) => setCycle(cycles.find((c) => c.id === v) || null)}>
            <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="Ciclo" /></SelectTrigger>
            <SelectContent>{cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <DashboardFilters areas={areas || []} filters={filters} onChange={setFilters} />
          <ExportButtons
            onExportExcel={() => {
              const areaName = filters.areaIds.length > 0
                ? (areas || []).filter((a) => filters.areaIds.includes(a.id)).map((a) => a.name).join(", ")
                : "Empresa inteira";
              const getAreaNameFn = (areaId: string | null) => {
                if (!areaId) return "—";
                return (areas || []).find((a) => a.id === areaId)?.name || "—";
              };
              exportExcel({
                cycleName: currentCycle?.name || "",
                areaName,
                objectives: filteredObjectives,
                keyResults: filteredKRs,
                milestonesMap,
                checkinsMap,
                cycle: currentCycle,
                areas: areas || [],
                getAreaName: getAreaNameFn,
              });
            }}
            onExportPDF={() => {
              const areaName = filters.areaIds.length > 0
                ? (areas || []).filter((a) => filters.areaIds.includes(a.id)).map((a) => a.name).join(", ")
                : "Empresa inteira";
              const getAreaNameFn = (areaId: string | null) => {
                if (!areaId) return "—";
                return (areas || []).find((a) => a.id === areaId)?.name || "—";
              };
              exportPDF({
                cycleName: currentCycle?.name || "",
                areaName,
                objectives: filteredObjectives,
                keyResults: filteredKRs,
                milestonesMap,
                checkinsMap,
                cycle: currentCycle,
                areas: areas || [],
                getAreaName: getAreaNameFn,
              });
            }}
          />
        </div>
      </div>

      {/* Column Chart - Performance por Área */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Performance por Área
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[260px]"><p className="text-xs">Progresso médio dos OKRs de cada área no ciclo atual</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={colChartConfig} style={{ height: "350px", width: "100%" }}>
            <BarChart data={areaProgressData} layout="horizontal" margin={{ top: 20, right: 16, left: 8, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="progress" position="top" formatter={(v: number) => `${v}%`} className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Relatório Executivo por Área */}
      {currentCycle && (areas || []).filter(a => filteredAreaIds.length === 0 || filteredAreaIds.includes(a.id)).map((area) => {
        const areaObjs = (objectives || []).filter((o: any) => !o.archived && o.area_id === area.id);
        if (areaObjs.length === 0) return null;
        const areaCheckinsMap: Record<string, any[]> = {};
        const areaKrIds = (keyResults || []).filter((kr: any) => areaObjs.some((o: any) => o.id === kr.objective_id)).map((kr: any) => kr.id);
        (allCheckins || []).forEach((c: any) => {
          if (!areaCheckinsMap[c.key_result_id]) areaCheckinsMap[c.key_result_id] = [];
          areaCheckinsMap[c.key_result_id].push(c);
        });
        const areaMilestonesMap: Record<string, any[]> = {};
        (milestones || []).forEach((m: any) => {
          if (!areaMilestonesMap[m.key_result_id]) areaMilestonesMap[m.key_result_id] = [];
          areaMilestonesMap[m.key_result_id].push(m);
        });
        return (
          <AIAreaSummary
            key={area.id}
            areaName={area.name}
            cycleId={currentCycle.id}
            objectives={areaObjs}
            milestonesMap={areaMilestonesMap}
            checkinsMap={areaCheckinsMap}
            progressKR={progressKR}
          />
        );
      })}

      {/* Farol de Preenchimento de Check-ins */}
      <CheckinFillRateTable
        areas={areas || []}
        objectives={(objectives || []).filter((o: any) => !o.archived)}
        keyResults={(keyResults || []).filter((kr: any) => !kr.archived)}
        milestones={milestones || []}
        allCheckins={allCheckins || []}
        filteredAreaIds={filteredAreaIds}
        currentCycle={currentCycle}
      />
    </div>
  );
}

/* ─── Check-in Fill Rate Table Component ─── */
const ALL_MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getCycleMonths(cycle: any): { months: string[]; labels: string[] } {
  if (!cycle?.start_date || !cycle?.end_date) {
    return { months: ["01","02","03","04","05","06"], labels: ["Jan","Fev","Mar","Abr","Mai","Jun"] };
  }
  const start = new Date(cycle.start_date + "T00:00:00");
  const end = new Date(cycle.end_date + "T00:00:00");
  const months: string[] = [];
  const labels: string[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= end) {
    months.push(String(d.getMonth() + 1).padStart(2, "0"));
    labels.push(ALL_MONTH_LABELS_PT[d.getMonth()]);
    d.setMonth(d.getMonth() + 1);
  }
  return { months, labels };
}

type FillStatus = "ok" | "attention" | "critical" | "no-data";

function getFillStatusStyle(status: FillStatus) {
  const map: Record<FillStatus, { bg: string; text: string; label: string; rowBg: string; badgeBg: string; badgeText: string }> = {
    ok: { bg: "bg-status-on-track-bg", text: "text-status-on-track", label: "OK", rowBg: "bg-status-on-track-bg/30", badgeBg: "bg-status-on-track", badgeText: "text-white" },
    attention: { bg: "bg-status-at-risk-bg", text: "text-status-at-risk", label: "Atenção", rowBg: "bg-status-at-risk-bg/30", badgeBg: "bg-status-at-risk", badgeText: "text-white" },
    critical: { bg: "bg-status-off-track-bg", text: "text-status-off-track", label: "Crítico", rowBg: "bg-status-off-track-bg/30", badgeBg: "bg-status-off-track", badgeText: "text-white" },
    "no-data": { bg: "bg-muted", text: "text-muted-foreground", label: "Sem dados", rowBg: "bg-muted/30", badgeBg: "bg-muted-foreground", badgeText: "text-white" },
  };
  return map[status];
}

function fillStatusOrder(s: FillStatus): number {
  return { critical: 0, attention: 1, ok: 2, "no-data": 3 }[s];
}

function CheckinFillRateTable({
  areas,
  objectives,
  keyResults,
  milestones,
  allCheckins,
  filteredAreaIds,
  currentCycle,
}: {
  areas: any[];
  objectives: any[];
  keyResults: any[];
  milestones: any[];
  allCheckins: any[];
  filteredAreaIds: Set<string> | null;
  currentCycle: any;
}) {
  const data = useMemo(() => {
    if (!areas.length || !keyResults.length) return [];

    // Parse date string directly to avoid timezone issues (e.g. "2026-01-01" → 2026)
    const { months: cycleMonths, labels: cycleLabels } = getCycleMonths(currentCycle);
    const now = new Date();
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const cycleYear = currentCycle?.start_date ? parseInt(currentCycle.start_date.slice(0, 4), 10) : now.getFullYear();
    // Show all cycle months; mark future ones separately
    const months = cycleMonths;
    const monthLabels = cycleLabels;
    const isPastMonth = (mm: string) => `${cycleYear}-${mm}` <= nowKey;

    // Build milestone map: kr_id -> milestones[]
    const msMap: Record<string, any[]> = {};
    milestones.forEach((m: any) => {
      if (m.archived) return;
      if (!msMap[m.key_result_id]) msMap[m.key_result_id] = [];
      msMap[m.key_result_id].push(m);
    });

    // Build checkin sets by reference_month
    // KR is filled in month X if: direct check-in with ref month X, OR any milestone has check-in with ref month X
    const checkinByKrMonth = new Set<string>();
    const checkinByMsMonth = new Set<string>();
    (allCheckins || []).forEach((c: any) => {
      const refMonth = c.reference_month; // "YYYY-MM"
      if (!refMonth) return;
      const mm = refMonth.slice(5, 7);
      const yyyy = refMonth.slice(0, 4);
      if (yyyy !== String(cycleYear)) return;
      checkinByKrMonth.add(`${c.key_result_id}|${mm}`);
      if (c.milestone_id) {
        checkinByMsMonth.add(`${c.milestone_id}|${mm}`);
      }
    });

    // Helper: is KR filled in month mm?
    function isKRFilled(kr: any, mm: string): boolean {
      // Direct check-in on KR
      if (checkinByKrMonth.has(`${kr.id}|${mm}`)) return true;
      // Or any milestone of this KR has a check-in
      if (kr.has_milestones && msMap[kr.id]) {
        return msMap[kr.id].some((m: any) => checkinByMsMonth.has(`${m.id}|${mm}`));
      }
      return false;
    }

    // Group KRs by objective
    const krsByObj: Record<string, any[]> = {};
    keyResults.forEach((kr: any) => {
      if (!krsByObj[kr.objective_id]) krsByObj[kr.objective_id] = [];
      krsByObj[kr.objective_id].push(kr);
    });

    const relevantAreas = filteredAreaIds
      ? areas.filter((a) => filteredAreaIds.has(a.id))
      : areas;

    return relevantAreas.map((area) => {
      // OKRs of this area
      const areaOKRs = objectives.filter((o: any) => o.area_id === area.id);

      if (areaOKRs.length === 0) {
        return {
          areaName: area.name,
          months: months.map(() => null as number | null),
          monthLabels,
          avg: null as number | null,
          status: "no-data" as FillStatus,
        };
      }

      const monthPcts = months.map((mm) => {
        // Future months: skip calculation, show as no-data
        if (!isPastMonth(mm)) return null;
        // Calculate % of KRs (not objectives) that have a checkin for this month
        const allKRs = areaOKRs.flatMap((obj: any) => krsByObj[obj.id] || []);
        if (allKRs.length === 0) return null;
        const filledKRs = allKRs.filter((kr: any) => isKRFilled(kr, mm)).length;
        return filledKRs / allKRs.length;
      });

      const validPcts = monthPcts.filter((p): p is number => p !== null);
      const avg = validPcts.length > 0 ? validPcts.reduce((s, v) => s + v, 0) / validPcts.length : null;

      let status: FillStatus = "no-data";
      if (avg !== null) {
        // Status based purely on average fill rate
        if (avg >= 0.8) {
          status = "ok";
        } else if (avg >= 0.5) {
          status = "attention";
        } else {
          status = "critical";
        }
      }

      return { areaName: area.name, months: monthPcts, monthLabels, avg, status };
    })
    .sort((a, b) => {
      const so = fillStatusOrder(a.status) - fillStatusOrder(b.status);
      if (so !== 0) return so;
      return (b.avg ?? -1) - (a.avg ?? -1);
    });
  }, [areas, objectives, keyResults, milestones, allCheckins, filteredAreaIds, currentCycle]);

  if (data.length === 0) return null;

  const monthLabels = data[0]?.monthLabels || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Farol de Preenchimento de OKRs
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
              <TooltipContent side="right" className="max-w-[320px]">
                <div className="text-xs space-y-1">
                  <p>% de OKRs com todos os KRs preenchidos (ao menos 1 check-in por mês de referência), por área.</p>
                  <ul className="mt-1 space-y-0.5">
                    <li><span className="font-semibold text-status-on-track">OK:</span> todos os meses com 100%</li>
                    <li><span className="font-semibold text-status-at-risk">Atenção:</span> Média 50-79% ou algum mês &lt; 70%</li>
                    <li><span className="font-semibold text-status-off-track">Crítico:</span> Média &lt; 50% ou algum mês &lt; 50%</li>
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-md" style={{ maxHeight: `${ROW_HEIGHT * MAX_VISIBLE}px` }}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead>Status</TableHead>
                {monthLabels.map((m) => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
                <TableHead className="text-center">Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const style = getFillStatusStyle(row.status);
                return (
                  <TableRow key={row.areaName} className={style.rowBg}>
                    <TableCell className="font-medium text-sm">{row.areaName}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.badgeBg} ${style.badgeText}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {style.label}
                      </span>
                    </TableCell>
                    {row.months.map((pct, i) => (
                      <TableCell key={i} className="text-center text-sm font-medium">
                        {pct !== null ? `${Math.round(pct * 100)}%` : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-sm font-bold">
                      {row.avg !== null ? `${Math.round(row.avg * 100)}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}



