import { Link, useNavigate } from "react-router-dom";
import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState, useCallback, useEffect, Fragment } from "react";
import { useApp } from "@/contexts/AppContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useObjectives, useKeyResults, useMilestones, useAreas, useAllCheckins } from "@/hooks/useOKRData";
import { progressKR, progressObjective, getKRStatus, getObjectiveStatus, expectedProgress, formatPercent, formatValue, statusOrder, statusLabel, type OKRStatus } from "@/lib/okr-utils";
import KRCard from "@/components/okr/KRCard";
import AddKRDialog from "@/components/okr/AddKRDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import AddKRDialog from "@/components/okr/AddKRDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import AddKRDialog from "@/components/okr/AddKRDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import AIAreaSummary from "@/components/okr/AIAreaSummary";
import AddKRDialog from "@/components/okr/AddKRDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import AddKRDialog from "@/components/okr/AddKRDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import CheckinDialog from "@/components/okr/CheckinDialog";
import ProgressBar from "@/components/okr/ProgressBar";
import StatusBadge from "@/components/okr/StatusBadge";
import EditObjectiveDialog from "@/components/okr/EditObjectiveDialog";
import EditKRDialog from "@/components/okr/EditKRDialog";
import EditKRDialog from "@/components/okr/EditKRDialog";
import EditKRDialog from "@/components/okr/EditKRDialog";
import DeleteConfirmDialog from "@/components/okr/DeleteConfirmDialog";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPDF } from "@/lib/export-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Pencil, ChevronDown, ChevronUp, Trash2, X, LayoutList, Table2, Plus, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const AREA_FILTER_KEY = "okrflow-area-filter";
const STATUS_FILTER_KEY = "okrflow-okrs-status-filter";
const EXPANDED_KEY = "okrflow-expanded-okrs";
const ALL_STATUSES: OKRStatus[] = ["off-track", "at-risk", "on-track", "completed"];

function loadAreaFilter(): string {
  try {
    return localStorage.getItem(AREA_FILTER_KEY) || "all";
  } catch { return "all"; }
}

function loadExpandedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveExpandedIds(ids: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
  } catch {}
}


// Extrai o tag MacroOKR do título do objetivo
function parseMacroOKR(title: string): { label: string; mainTitle: string } {
  const match = title.match(/^(.*?)\s*\(MacroOKR:\s*(.+?)\)\s*$/);
  if (match) return { mainTitle: match[1].trim(), label: match[2].trim() };
  return { mainTitle: title, label: "" };
}


// Extrai o tag MacroOKR do título do objetivo
export default function OKRs() {
  const { currentCycle, setCycle, cycles, currentUser, currentUserAreaIds, selectedOKRAreaId, areas: contextAreas } = useApp();
  const [editObj, setEditObj] = useState<any>(null);
  const [editKR, setEditKR] = useState<any>(null);
  const [deleteObj, setDeleteObj] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const { data: objectives } = useObjectives(currentCycle?.id);
  const { data: keyResults } = useKeyResults(currentCycle?.id);
  const { data: areas } = useAreas();
  const [areaFilter, setAreaFilter] = useState<string>(() => {
    if (selectedOKRAreaId) return selectedOKRAreaId;
    return loadAreaFilter();
  });

  // Sync sidebar area selection → filter
  useEffect(() => {
    if (selectedOKRAreaId) {
      setAreaFilter(selectedOKRAreaId);
      localStorage.setItem(AREA_FILTER_KEY, selectedOKRAreaId);
    } else {
      setAreaFilter("all");
    }
  }, [selectedOKRAreaId]);
  const [statusFilter, setStatusFilter] = useState<OKRStatus[]>(() => {
    try { const raw = localStorage.getItem(STATUS_FILTER_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);
  const [checkinKR, setCheckinKR] = useState<any>(null);
  const [addKRObj, setAddKRObj] = useState<any>(null);
  const [quickCheckinOpen, setQuickCheckinOpen] = useState(false);
  const [quickSelectedObjId, setQuickSelectedObjId] = useState<string>("");
  const [quickSelectedKRId, setQuickSelectedKRId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => (localStorage.getItem("okr-view-mode") as any) || "cards");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveExpandedIds(next);
      return next;
    });
  }, []);

  const krIds = useMemo(() => (keyResults || []).filter((kr) => kr.has_milestones).map((kr) => kr.id), [keyResults]);
  const allKrIds = useMemo(() => (keyResults || []).map((kr) => kr.id), [keyResults]);
  const { data: milestones } = useMilestones(krIds);
  const { data: allCheckins } = useAllCheckins(currentCycle?.id, allKrIds);

  const checkinsMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (allCheckins || []).forEach((c: any) => {
      if (!map[c.key_result_id]) map[c.key_result_id] = [];
      map[c.key_result_id].push(c);
    });
    return map;
  }, [allCheckins]);

  const milestonesMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (milestones || []).forEach((m) => {
      if (!map[m.key_result_id]) map[m.key_result_id] = [];
      map[m.key_result_id].push(m);
    });
    return map;
  }, [milestones]);

  // Calculate area performance: average progress of all objectives per area
  const areaPerformance = useMemo(() => {
    if (!objectives || !keyResults) return {} as Record<string, number>;
    const perf: Record<string, { total: number; count: number }> = {};
    for (const obj of objectives) {
      if (!obj.area_id) continue;
      const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id && !kr.archived);
      const objProg = progressObjective(objKRs, milestonesMap, checkinsMap);
      if (!perf[obj.area_id]) perf[obj.area_id] = { total: 0, count: 0 };
      perf[obj.area_id].total += objProg;
      perf[obj.area_id].count += 1;
    }
    const result: Record<string, number> = {};
    for (const [areaId, { total, count }] of Object.entries(perf)) {
      result[areaId] = count > 0 ? total / count : 0;
    }
    return result;
  }, [objectives, keyResults, milestonesMap, checkinsMap]);

  const filteredObjectives = useMemo(() => {
    if (!objectives || !keyResults) return [];
    return objectives.filter((obj: any) => {
      // Admin: only show OKRs from their areas
      if (currentUser?.role === "admin") {
        const inArea = obj.area_id && currentUserAreaIds.includes(obj.area_id);
        const isResponsible = obj.owner_user_id === currentUser?.id;
        if (!inArea && !isResponsible) return false;
      }
      if (areaFilter !== "all" && obj.area_id !== areaFilter) return false;
      if (statusFilter.length > 0 && currentCycle) {
        const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id);
        const objStatus = getObjectiveStatus(objKRs, currentCycle, milestonesMap, checkinsMap);
        if (!statusFilter.includes(objStatus)) return false;
      }
      return true;
    });
  }, [objectives, keyResults, areaFilter, statusFilter, currentCycle, milestonesMap, checkinsMap, currentUser, currentUserAreaIds]);

  // Enrich objectives with _krs and _score for AI summary
  const enrichedObjectives = useMemo(() => {
    if (!filteredObjectives || !keyResults) return filteredObjectives;
    return filteredObjectives.map((obj: any) => {
      const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id && !kr.archived);
      return { ...obj, _krs: objKRs, _score: progressObjective(objKRs, milestonesMap, checkinsMap) };
    });
  }, [filteredObjectives, keyResults, milestonesMap, checkinsMap]);



  // Group filtered objectives by area
  const groupedByArea = useMemo(() => {
    const groups: { areaId: string | null; areaName: string; objectives: any[] }[] = [];
    const areaMap = new Map<string | null, any[]>();
    const areaOrder: (string | null)[] = [];

    enrichedObjectives.forEach((obj: any) => {
      const key = obj.area_id || null;
      if (!areaMap.has(key)) {
        areaMap.set(key, []);
        areaOrder.push(key);
      }
      areaMap.get(key)!.push(obj);
    });

    areaOrder.forEach((areaId) => {
      const areaName = areaId
        ? (areas || []).find((a) => a.id === areaId)?.name || "Sem área"
        : "Sem área";
      groups.push({ areaId, areaName, objectives: areaMap.get(areaId)! });
    });

    // Sort groups alphabetically by area name
    groups.sort((a, b) => a.areaName.localeCompare(b.areaName));
    return groups;
  }, [filteredObjectives, areas]);


  // Generate month columns from cycle dates
  const monthCols = useMemo(() => {
    if (!currentCycle) return [];
    const start = new Date(currentCycle.start_date);
    const end = new Date(currentCycle.end_date);
    const months: { key: string; label: string }[] = [];
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1) });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [currentCycle]);

  // Monthly checkin values per KR
  const monthlyMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    (allCheckins || []).forEach((c: any) => {
      if (!map[c.key_result_id]) map[c.key_result_id] = {};
      const m = c.reference_month || "";
      map[c.key_result_id][m] = (map[c.key_result_id][m] || 0) + (c.value || 0);
    });
    return map;
  }, [allCheckins]);







  const expected = currentCycle ? expectedProgress(currentCycle) : 0;

  function handleAreaFilterChange(value: string) {
    setAreaFilter(value);
    localStorage.setItem(AREA_FILTER_KEY, value);
  }

  async function handleDeleteObjective() {
    if (!deleteObj) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("objectives").update({ archived: true }).eq("id", deleteObj.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
      toast({ title: "Objetivo excluído!" });
      setDeleteObj(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            OKRs
            {filteredObjectives.length > 0 && keyResults && currentCycle && (
              <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                {formatPercent(
                  filteredObjectives.filter((o: any) => !o.archived).reduce((sum: number, obj: any) => {
                    const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id && !kr.archived);
                    return sum + progressObjective(objKRs, milestonesMap, checkinsMap);
                  }, 0) / Math.max(filteredObjectives.filter((o: any) => !o.archived).length, 1)
                )}
              </Badge>
            )}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Select value={currentCycle?.id || ""} onValueChange={(v) => setCycle(cycles.find((c) => c.id === v) || null)}>
              <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="Ciclo" /></SelectTrigger>
              <SelectContent>{cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">Ciclo {currentCycle?.name}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">

          {/* Status Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Status
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{statusFilter.length}</Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-2">
              <div className="space-y-1">
                {ALL_STATUSES.map((s) => (
                  <label key={s} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm">
                    <Checkbox
                      checked={statusFilter.includes(s)}
                      onCheckedChange={() => {
                        const next = statusFilter.includes(s) ? statusFilter.filter((v) => v !== s) : [...statusFilter, s];
                        setStatusFilter(next);
                        localStorage.setItem(STATUS_FILTER_KEY, JSON.stringify(next));
                      }}
                    />
                    {statusLabel(s)}
                  </label>
                ))}
              </div>
              {statusFilter.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => { setStatusFilter([]); localStorage.removeItem(STATUS_FILTER_KEY); }}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === "cards" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5" onClick={() => { setViewMode("cards"); localStorage.setItem("okr-view-mode", "cards"); }}>
              <LayoutList className="h-4 w-4" /> Cards
            </Button>
            <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="rounded-none gap-1.5" onClick={() => { setViewMode("table"); localStorage.setItem("okr-view-mode", "table"); }}>
              <Table2 className="h-4 w-4" /> Tabela
            </Button>
          </div>
          <ExportButtons
            onExportExcel={() => {
              const areaName = areaFilter === "all" ? "Empresa inteira" : (areas || []).find((a) => a.id === areaFilter)?.name || "Empresa inteira";
              const getAreaNameFn = (areaId: string | null) => {
                if (!areaId) return "—";
                return (areas || []).find((a) => a.id === areaId)?.name || "—";
              };
              exportExcel({
                cycleName: currentCycle?.name || "",
                areaName,
                objectives: filteredObjectives,
                keyResults: (keyResults || []).filter((kr) => filteredObjectives.some((o: any) => o.id === kr.objective_id)),
                milestonesMap,
                checkinsMap,
                cycle: currentCycle,
                areas: areas || [],
                getAreaName: getAreaNameFn,
              });
            }}
            onExportPDF={() => {
              const areaName = areaFilter === "all" ? "Empresa inteira" : (areas || []).find((a) => a.id === areaFilter)?.name || "Empresa inteira";
              const getAreaNameFn = (areaId: string | null) => {
                if (!areaId) return "—";
                return (areas || []).find((a) => a.id === areaId)?.name || "—";
              };
              exportPDF({
                cycleName: currentCycle?.name || "",
                areaName,
                objectives: filteredObjectives,
                keyResults: (keyResults || []).filter((kr) => filteredObjectives.some((o: any) => o.id === kr.objective_id)),
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

      {viewMode === "cards" && groupedByArea.map(({ areaId, areaName, objectives: areaObjs }) => (
        <div key={areaId || "no-area"} className="space-y-3">
          {/* Area section header */}
          <div style={{background:"#2659a5",borderBottom:"3px solid #d7d900",borderRadius:"8px 8px 0 0"}} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-white" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">{areaName}</h2>
            </div>
            {areaId && areaPerformance[areaId] !== undefined && (
              <span className="text-sm font-bold" style={{color:"#d7d900"}}>{formatPercent(areaPerformance[areaId])}</span>
            )}
          </div>

          {currentCycle && viewMode === "cards" && (
            <AIAreaSummary
              areaName={areaName}
              cycleId={currentCycle.id}
              objectives={areaObjs}
              milestonesMap={milestonesMap}
              checkinsMap={checkinsMap}
              progressKR={progressKR}
            />
          )}

          {areaObjs.map((obj: any) => {
            const objKRs = (keyResults || []).filter((kr) => kr.objective_id === obj.id);
            const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
            const sortedKRs = [...objKRs].sort((a, b) => {
              if (!currentCycle) return 0;
              return statusOrder(getKRStatus(a, currentCycle, milestonesMap[a.id], checkinsMap[a.id])) - statusOrder(getKRStatus(b, currentCycle, milestonesMap[b.id], checkinsMap[b.id]));
            });

            const canEdit = currentUser?.role === "owner" || (currentUser?.role === "admin" && (( obj.area_id && currentUserAreaIds.includes(obj.area_id)) || obj.owner_user_id === currentUser?.id));
            const isExpanded = expandedIds.has(obj.id);

            return (
              <Card key={obj.id} className="animate-fade-in overflow-hidden" style={{border:"1px solid #c8ddf5",boxShadow:"0 2px 8px rgba(38,89,165,0.12)"}}>
                <CardHeader
                  className="pb-3 cursor-pointer select-none"
                  onClick={() => toggleExpanded(obj.id)}
                  style={{background:"#fff"}}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {obj.external_id && (
                          <span className="text-xs font-mono text-muted-foreground">{obj.external_id}</span>
                        )}
                        {obj.areas?.name && (
                          <span style={{background:"hsl(var(--accent))",color:"hsl(var(--primary))",border:"1px solid hsl(var(--border))"}} className="text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {obj.areas.name}
                          </span>
                        )}
                      </div>
                      {(() => { const { mainTitle, label } = parseMacroOKR(obj.title); return (
                        <>
                          {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/60 mb-1 block">MacroOKR: {label}</span>}
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{mainTitle}</CardTitle>
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditObj(obj); }} title="Editar objetivo">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setAddKRObj(obj); }} title="Novo KR">
                                  <Plus className="h-3 w-3" />KR
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteObj(obj); }} title="Excluir objetivo">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </>
                      ); })()}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xl font-bold">{formatPercent(objProgress)}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <User className="h-3 w-3" />
                          {obj.app_users?.name}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground transition-transform" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                      )}
                    </div>
                  </div>
                  <ProgressBar
                    progress={objProgress}
                    status={objProgress >= expected * 0.7 ? "on-track" : objProgress >= expected * 0.4 ? "at-risk" : "off-track"}
                    expected={expected}
                    className="mt-3"
                  />
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-2 animate-fade-in">
                    {sortedKRs.map((kr: any) => (
                      <KRCard key={kr.id} kr={kr} milestones={milestonesMap[kr.id]} checkins={checkinsMap[kr.id]} />
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ))}

      {/* TABLE VIEW */}
      {viewMode === "table" && (
        <div className="space-y-6">
          {groupedByArea.map(({ areaId, areaName, objectives: areaObjs }) => {
            const areaScore = areaId && areaPerformance[areaId] !== undefined ? areaPerformance[areaId] : null;
            return (
              <div key={areaId || "no-area"} className="rounded-lg border border-border overflow-hidden">
                {/* AI Summary in table view */}
                {currentCycle && (
                  <AIAreaSummary
                    areaName={areaName}
                    cycleId={currentCycle.id}
                    objectives={areaObjs}
                    milestonesMap={milestonesMap}
                    checkinsMap={checkinsMap}
                    progressKR={progressKR}
                  />
                )}
                {/* Area header */}
                <div style={{background:"#2659a5",borderBottom:"3px solid #d7d900"}} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-white" />
                    <span className="font-bold text-sm uppercase tracking-wider text-white">{areaName}</span>
                  </div>
                  {areaScore !== null && (
                    <span className="text-sm font-bold" style={{color:"#d7d900"}}>{formatPercent(areaScore)}</span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[900px]">
                    <thead>
                      <tr style={{background:"#0f2860",color:"#fff"}}>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase w-[340px]">OKR / Key Result</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase w-[110px]">Capitão</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase">Grade 0</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase">Grade 1</th>
                        {monthCols.map((m) => (
                          <th key={m.key} className="text-right px-3 py-2 font-semibold">{m.label}</th>
                        ))}
                        <th className="text-right px-3 py-2 font-semibold">Final</th>
                        <th className="text-right px-3 py-2 font-semibold">Score</th>
                        <th className="px-3 py-2 font-semibold w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {areaObjs.map((obj: any) => {
                        const objKRs = (keyResults || []).filter((kr) => kr.objective_id === obj.id && !kr.archived);
                        const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
                        const canEdit = currentUser?.role === "owner" || (currentUser?.role === "admin" && (( obj.area_id && currentUserAreaIds.includes(obj.area_id)) || obj.owner_user_id === currentUser?.id));
                        return (
                          <>
                            <tr key={`obj-${obj.id}`} style={{background:"hsl(var(--muted))",borderTop:"4px solid #2659a5"}}>
                              <td className="px-4 py-3 font-bold text-sm" style={{color:"hsl(var(--foreground))"}} colSpan={4 + monthCols.length}>
                                {(() => { const { mainTitle, label } = parseMacroOKR(obj.title); return (
                              <>
                                {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/70 block mb-0.5">{label}</span>}
                                {mainTitle}
                              </>
                            ); })()}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-sm" style={{color:"#2659a5"}}>{formatPercent(objProgress)}</td>
                              <td className="px-3 py-2" />
                            </tr>
                            {objKRs.map((kr: any) => {
                              const score = progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]);
                              const scoreColor = score >= 0.7 ? "text-green-600 dark:text-green-400" : score >= 0.4 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
                              const scoreBg = score >= 0.7 ? "bg-green-50 dark:bg-green-950/30" : score >= 0.4 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
                              const kms = milestonesMap[kr.id] || [];
                              return (
                                <Fragment key={kr.id}>
                                  <tr className="hover:bg-blue-50 transition-colors" style={{borderTop:"1px solid #c8ddf5"}}>
                                    <td className="px-3 py-2.5 pl-6 text-sm" style={{color:"#1a2f4f"}}>
                                      <div className="flex items-center gap-1.5">
                                        {kr.title}
                                        {(kr as any).description && (
                                          <TooltipProvider delayDuration={100}>
                                            <Tooltip>
                                              <TooltipTrigger asChild><MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0 cursor-help" /></TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-[300px]"><p className="text-xs font-semibold mb-1">Fala de C-Level</p><p className="text-xs italic">{(kr as any).description}</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-xs" style={{color:"#4a6fa5"}}>{(kr as any).app_users?.name || "—"}</td>
                                    <td className="px-3 py-2.5 text-right text-xs font-medium" style={{color:"#6b8fc4"}}>{formatValue(kr.grade0_value, kr.unit)}</td>
                                    <td className="px-3 py-2.5 text-right text-xs font-medium" style={{color:"#2659a5"}}>{formatValue(kr.grade1_value, kr.unit)}</td>
                                    {monthCols.map((m) => {
                                      const val = monthlyMap[kr.id]?.[m.key];
                                      return (
                                        <td key={m.key} className="px-3 py-2 text-right text-xs">
                                          {val != null ? formatValue(val, kr.unit) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                      );
                                    })}
                                    <td className="px-3 py-2 text-right text-xs font-medium">{kr.current_value != null ? formatValue(kr.current_value, kr.unit) : <span className="text-muted-foreground/30">—</span>}</td>
                                    <td className="px-3 py-2 text-right">
                                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${scoreColor} ${scoreBg}`}>{formatPercent(score)}</span>
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      {canEdit && (
                                        <div className="flex items-center gap-1 justify-center">
                                          <button onClick={() => setEditKR(kr)} className="text-muted-foreground hover:text-primary transition-colors" title="Editar KR">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          </button>
                                          <button onClick={() => setCheckinKR(kr)} className="text-muted-foreground hover:text-primary transition-colors" title="Atualizar OKR">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                  {kms.map((ms: any) => {
                                    const msPct = ms.target_value > 0 ? Math.min((ms.current_value ?? 0) / ms.target_value, 1) : 0;
                                    const msC = msPct >= 0.7 ? "text-green-600" : msPct >= 0.4 ? "text-yellow-600" : "text-red-600";
                                    const msB = msPct >= 0.7 ? "bg-green-50" : msPct >= 0.4 ? "bg-yellow-50" : "bg-red-50";
                                    return (
                                      <tr key={ms.id} style={{background:"hsl(var(--muted)/0.4)",borderTop:"1px solid #e0eaf8"}}>
                                        <td className="px-3 py-1.5 text-xs" style={{paddingLeft:"3rem",color:"#4a6fa5"}}>
                                          <span style={{borderLeft:"2px solid #2659a5",paddingLeft:"8px",fontStyle:"italic"}}>↳ {ms.title}</span>
                                        </td>
                                        <td></td>
                                        <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{formatValue(ms.grade0_value ?? 0, kr.unit)}</td>
                                        <td className="px-3 py-1.5 text-right text-xs" style={{color:"#2659a5"}}>{formatValue(ms.target_value, kr.unit)}</td>
                                        {monthCols.map((m) => <td key={m.key} className="px-3 py-1.5 text-center text-xs text-muted-foreground/30">—</td>)}
                                        <td className="px-3 py-1.5 text-right text-xs">{ms.current_value != null ? formatValue(ms.current_value, kr.unit) : "—"}</td>
                                        <td className="px-3 py-1.5 text-right"><span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${msC} ${msB}`}>{formatPercent(msPct)}</span></td>
                                        <td></td>
                                      </tr>
                                    );
                                  })}
                                </Fragment>
                              );
                            })}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {addKRObj && currentCycle && (
        <AddKRDialog open={!!addKRObj} onOpenChange={(v) => !v && setAddKRObj(null)} objectiveId={addKRObj.id} cycleId={currentCycle.id} areaId={addKRObj.area_id} />
      )}
      {checkinKR && (
        <CheckinDialog open={!!checkinKR} onOpenChange={(v) => !v && setCheckinKR(null)} kr={checkinKR} milestones={milestonesMap[checkinKR.id]} />
      )}
      {editKR && <EditKRDialog open={!!editKR} onOpenChange={(v) => !v && setEditKR(null)} kr={editKR} />}

      {/* Floating Atualizar OKR button */}
      <button
        onClick={() => { setQuickCheckinOpen(true); setQuickSelectedObjId(""); setQuickSelectedKRId(""); }}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 50,
          background: "#2659a5", color: "#fff", border: "none",
          borderRadius: 12, padding: "12px 22px", fontSize: 14, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(38,89,165,0.4)", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#1a4a90"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#2659a5"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        Atualizar OKR
      </button>

      {/* Quick Checkin Dialog */}
      <Dialog open={quickCheckinOpen} onOpenChange={setQuickCheckinOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Atualizar OKR</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Objetivo</Label>
              <select
                value={quickSelectedObjId}
                onChange={e => { setQuickSelectedObjId(e.target.value); setQuickSelectedKRId(""); }}
                style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #c8ddf5",fontSize:13,color:"#1a2f4f",background:"#f8faff"}}
              >
                <option value="">Selecione um objetivo...</option>
                {filteredObjectives.map((obj: any) => (
                  <option key={obj.id} value={obj.id}>{obj.title.replace(/\s*\(MacroOKR:.*?\)\s*$/,'').trim()}</option>
                ))}
              </select>
            </div>
            {quickSelectedObjId && (
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Key Result</Label>
                <select
                  value={quickSelectedKRId}
                  onChange={e => setQuickSelectedKRId(e.target.value)}
                  style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #c8ddf5",fontSize:13,color:"#1a2f4f",background:"#f8faff"}}
                >
                  <option value="">Selecione um KR...</option>
                  {(keyResults || []).filter((kr: any) => kr.objective_id === quickSelectedObjId && !kr.archived).map((kr: any) => (
                    <option key={kr.id} value={kr.id}>{kr.title}</option>
                  ))}
                </select>
              </div>
            )}
            {quickSelectedKRId && (
              <button
                onClick={() => {
                  const kr = (keyResults || []).find((k: any) => k.id === quickSelectedKRId);
                  if (kr) { setCheckinKR(kr); setQuickCheckinOpen(false); }
                }}
                style={{width:"100%",padding:"10px",borderRadius:8,background:"#2659a5",color:"#fff",border:"none",fontSize:14,fontWeight:600,cursor:"pointer"}}
              >
                Abrir Atualizar OKR
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editObj && <EditObjectiveDialog open={!!editObj} onOpenChange={(v) => !v && setEditObj(null)} objective={editObj} />}
      <DeleteConfirmDialog
        open={!!deleteObj}
        onOpenChange={(v) => !v && setDeleteObj(null)}
        title="Excluir Objetivo"
        description="Tem certeza que deseja excluir este objetivo? Todos os KRs associados permanecerão no sistema."
        onConfirm={handleDeleteObjective}
        loading={deleting}
      />
    </div>
  );
}
