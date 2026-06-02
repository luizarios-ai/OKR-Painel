import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
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
import CompanyEvolutionCharts from "@/components/dashboard/CompanyEvolutionCharts";

const ROW_HEIGHT = 49;
const MAX_VISIBLE = 7;

const STATUS_COLORS: Record<OKRStatus, string> = {
  "off-track": "hsl(var(--status-off-track))",
  "at-risk": "hsl(var(--status-at-risk))",
  "on-track": "hsl(var(--status-on-track))",
  completed: "hsl(var(--status-completed))",
};

export default function Dashboard() {
  const { currentCycle } = useApp();
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
        <div className="flex gap-2 flex-wrap">
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

      {/* Section 1: Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary border-primary">
          <CardContent className="pt-6 text-center">
            <Activity className="h-6 w-6 mx-auto mb-2 text-primary-foreground" />
            <div className="text-3xl font-bold text-primary-foreground">{formatPercent(okrStats.avgProgress)}</div>
            <div className="text-xs text-primary-foreground/90 font-medium mt-1 flex items-center justify-center gap-1">
              Progresso Geral OKR {filteredAreaIds ? "(Áreas selecionadas)" : "(Empresa)"}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-primary-foreground/70 cursor-help" /></TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]"><p className="text-xs">Média do progresso de todos os OKRs do ciclo atual</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              Total de KRs
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]"><p className="text-xs">Quantidade total de Key Results cadastrados no ciclo</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-primary" />
            <div className="text-2xl font-bold">{okrStats.total}</div>
            <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              Total de OKRs
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]"><p className="text-xs">Quantidade total de Objetivos cadastrados no ciclo</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: KR Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status dos KRs</h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <ul className="text-xs space-y-1">
                  <li><span className="font-semibold text-status-off-track">Crítico:</span> Progresso abaixo de 40% do esperado</li>
                  <li><span className="font-semibold text-status-at-risk">Atenção:</span> Progresso entre 40% e 70% do esperado</li>
                  <li><span className="font-semibold text-status-on-track">No planejado:</span> Progresso acima de 70% do esperado</li>
                  <li><span className="font-semibold text-status-completed">Completo:</span> Meta atingida ou superada</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 text-center">
              <TrendingDown className="h-5 w-5 mx-auto mb-1.5 text-status-off-track" />
              <div className="text-2xl font-bold">{stats.offTrack}</div>
              <div className="text-xs text-muted-foreground">KRs Críticos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1.5 text-status-at-risk" />
              <div className="text-2xl font-bold">{stats.atRisk}</div>
              <div className="text-xs text-muted-foreground">KRs em Atenção</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <Activity className="h-5 w-5 mx-auto mb-1.5 text-status-on-track" />
              <div className="text-2xl font-bold">{stats.onTrack}</div>
              <div className="text-xs text-muted-foreground">KRs No Planejado</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1.5 text-status-completed" />
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-xs text-muted-foreground">KRs Completos</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3: OKR Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status dos OKRs</h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[280px]">
                <ul className="text-xs space-y-1">
                  <li><span className="font-semibold text-status-off-track">Crítico:</span> Progresso abaixo de 40% do esperado</li>
                  <li><span className="font-semibold text-status-at-risk">Atenção:</span> Progresso entre 40% e 70% do esperado</li>
                  <li><span className="font-semibold text-status-on-track">No planejado:</span> Progresso acima de 70% do esperado</li>
                  <li><span className="font-semibold text-status-completed">Completo:</span> Meta atingida ou superada</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 text-center">
              <TrendingDown className="h-5 w-5 mx-auto mb-1.5 text-status-off-track" />
              <div className="text-2xl font-bold">{okrStats.offTrack}</div>
              <div className="text-xs text-muted-foreground">OKRs Críticos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <AlertTriangle className="h-5 w-5 mx-auto mb-1.5 text-status-at-risk" />
              <div className="text-2xl font-bold">{okrStats.atRisk}</div>
              <div className="text-xs text-muted-foreground">OKRs em Atenção</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <Activity className="h-5 w-5 mx-auto mb-1.5 text-status-on-track" />
              <div className="text-2xl font-bold">{okrStats.onTrack}</div>
              <div className="text-xs text-muted-foreground">OKRs No Planejado</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto mb-1.5 text-status-completed" />
              <div className="text-2xl font-bold">{okrStats.completed}</div>
              <div className="text-xs text-muted-foreground">OKRs Completos</div>
            </CardContent>
          </Card>
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
          <ChartContainer config={colChartConfig} className="aspect-[2/1] max-h-[300px]">
            <BarChart data={areaProgressData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="progress" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="progress" position="top" formatter={(v: number) => `${v}%`} className="fill-foreground text-xs" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Stacked Bar Chart - Status dos KRs por Área */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Status dos KRs por Área
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Quantidade de KRs em cada status (Crítico, Atenção, No planejado, Completo) por área</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="aspect-[2/1] max-h-[300px]">
            <BarChart data={statusByAreaData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" />
              <YAxis dataKey="name" type="category" width={100} className="text-xs" />
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
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS["completed"]} radius={[0, 4, 4, 0]}>
                <LabelList dataKey="completed" position="center" formatter={(v: number) => v > 0 ? v : ""} className="fill-white text-[10px]" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Company Evolution Charts */}
      {currentCycle && filteredKRs.length > 0 && filteredObjectives.length > 0 && (
        <CompanyEvolutionCharts
          cycle={currentCycle}
          objectives={filteredObjectives}
          keyResults={filteredKRs}
          checkins={allCheckins || []}
          milestonesMap={milestonesMap}
        />
      )}

      {/* KRs Críticos e em Atenção - TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            KRs Críticos e em Atenção
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Lista dos KRs com progresso abaixo de 70% do esperado, que precisam de atenção</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topOffTrackKRs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum KR Crítico ou em Atenção 🎉</p>
          ) : (
            <div className="overflow-auto border rounded-md" style={{ maxHeight: `${TABLE_MAX_H}px` }}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>KR</TableHead>
                    <TableHead>Objective</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOffTrackKRs.map(({ kr, status, progress, objective }) => (
                    <TableRow key={kr.id}>
                      <TableCell className="font-medium max-w-[200px]">
                        <Link to={`/kr/${kr.id}`} className="hover:text-primary transition-colors line-clamp-1">
                          {kr.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{objective?.title || "—"}</TableCell>
                      <TableCell className="text-sm">{getAreaName((kr as any).area_id)}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPercent(progress)}</TableCell>
                      <TableCell className="text-sm">{(kr as any).app_users?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OKRs Críticos e em Atenção - TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            OKRs Críticos e em Atenção
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Lista dos Objetivos com progresso abaixo de 70% do esperado, que precisam de atenção</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topOffTrackOKRs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum OKR Crítico ou em Atenção 🎉</p>
          ) : (
            <div className="overflow-auto border rounded-md" style={{ maxHeight: `${TABLE_MAX_H}px` }}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Objective</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOffTrackOKRs.map(({ obj, status, progress }) => (
                    <TableRow key={obj.id}>
                      <TableCell className="font-medium max-w-[250px] truncate">{obj.title}</TableCell>
                      <TableCell className="text-sm">{getAreaName(obj.area_id)}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPercent(progress)}</TableCell>
                      <TableCell className="text-sm">{obj.app_users?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OKRs No Planejado e Completos - TABLE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            OKRs No Planejado e Completos
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px]"><p className="text-xs">Lista dos Objetivos com progresso acima de 70% do esperado ou já concluídos</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onTrackAndCompletedOKRs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum OKR No Planejado ou Completo</p>
          ) : (
            <div className="overflow-auto border rounded-md" style={{ maxHeight: `${TABLE_MAX_H}px` }}>
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>Objective</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progresso</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onTrackAndCompletedOKRs.map(({ obj, status, progress }) => (
                    <TableRow key={obj.id}>
                      <TableCell className="font-medium max-w-[250px] truncate">{obj.title}</TableCell>
                      <TableCell className="text-sm">{getAreaName(obj.area_id)}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatPercent(progress)}</TableCell>
                      <TableCell className="text-sm">{obj.app_users?.name || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
const ALL_MONTHS = ["01", "02", "03", "04", "05", "06"] as const;
const ALL_MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];

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
    const cycleYear = currentCycle?.start_date ? parseInt(currentCycle.start_date.slice(0, 4), 10) : new Date().getFullYear();

    // Evaluate months from Jan up to the month BEFORE current (inclusive)
    // e.g. if today is April → evaluate Jan, Feb, Mar
    const now = new Date();
    const lastEvalMonth = now.getFullYear() === cycleYear ? now.getMonth() : 6; // getMonth() is 0-based, so Apr=3 → evaluate up to month 3 (Mar)
    const months = ALL_MONTHS.filter((mm) => parseInt(mm) <= lastEvalMonth);
    const monthLabels = ALL_MONTH_LABELS.filter((_, i) => parseInt(ALL_MONTHS[i]) <= lastEvalMonth);

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
        const totalOKRs = areaOKRs.length;
        let filledOKRs = 0;

        areaOKRs.forEach((obj: any) => {
          const objKRs = krsByObj[obj.id] || [];
          if (objKRs.length === 0) return; // OKR without KRs doesn't count as filled
          const allKRsFilled = objKRs.every((kr: any) => isKRFilled(kr, mm));
          if (allKRsFilled) filledOKRs++;
        });

        return totalOKRs > 0 ? filledOKRs / totalOKRs : null;
      });

      const validPcts = monthPcts.filter((p): p is number => p !== null);
      const avg = validPcts.length > 0 ? validPcts.reduce((s, v) => s + v, 0) / validPcts.length : null;

      let status: FillStatus = "no-data";
      if (avg !== null) {
        // Green only if ALL months are 100%
        if (avg >= 1 && validPcts.every((p) => p >= 1)) {
          status = "ok";
        } else if (avg >= 0.5) {
          status = "attention";
        } else {
          status = "critical";
        }

        // Escalation: any month < 50% → critical
        const hasBelow50 = validPcts.some((p) => p < 0.5);
        const hasBelow70 = validPcts.some((p) => p < 0.7);

        if (hasBelow50) status = "critical";
        else if (hasBelow70 && status === "ok") status = "attention";
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
