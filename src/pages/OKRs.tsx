import { useMemo, useState, useCallback } from "react";
import { useApp } from "@/contexts/AppContext";
import { useObjectives, useKeyResults, useMilestones, useAreas, useAllCheckins } from "@/hooks/useOKRData";
import { progressKR, progressObjective, getKRStatus, getObjectiveStatus, expectedProgress, formatPercent, statusOrder, statusLabel, type OKRStatus } from "@/lib/okr-utils";
import KRCard from "@/components/okr/KRCard";
import ProgressBar from "@/components/okr/ProgressBar";
import StatusBadge from "@/components/okr/StatusBadge";
import EditObjectiveDialog from "@/components/okr/EditObjectiveDialog";
import DeleteConfirmDialog from "@/components/okr/DeleteConfirmDialog";
import ExportButtons from "@/components/ExportButtons";
import { exportExcel, exportPDF } from "@/lib/export-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Pencil, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
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

export default function OKRs() {
  const { currentCycle, currentUser, currentUserAreaIds } = useApp();
  const [editObj, setEditObj] = useState<any>(null);
  const [deleteObj, setDeleteObj] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const { data: objectives } = useObjectives(currentCycle?.id);
  const { data: keyResults } = useKeyResults(currentCycle?.id);
  const { data: areas } = useAreas();
  const [areaFilter, setAreaFilter] = useState<string>(loadAreaFilter);
  const [statusFilter, setStatusFilter] = useState<OKRStatus[]>(() => {
    try { const raw = localStorage.getItem(STATUS_FILTER_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(loadExpandedIds);
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
        if (!obj.area_id || !currentUserAreaIds.includes(obj.area_id)) return false;
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

  // Group filtered objectives by area
  const groupedByArea = useMemo(() => {
    const groups: { areaId: string | null; areaName: string; objectives: any[] }[] = [];
    const areaMap = new Map<string | null, any[]>();
    const areaOrder: (string | null)[] = [];

    filteredObjectives.forEach((obj: any) => {
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
          <p className="text-muted-foreground text-sm">Ciclo {currentCycle?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={areaFilter} onValueChange={handleAreaFilterChange}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Áreas</SelectItem>
              {(areas || []).filter((a) => currentUser?.role === "owner" || currentUserAreaIds.includes(a.id)).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
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

      {groupedByArea.map(({ areaId, areaName, objectives: areaObjs }) => (
        <div key={areaId || "no-area"} className="space-y-3">
          {/* Area section header */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                {areaName}
              </h2>
              {areaId && areaPerformance[areaId] !== undefined && (
                <span className="text-sm font-semibold text-muted-foreground">
                  · {formatPercent(areaPerformance[areaId])}
                </span>
              )}
            </div>
            <div className="flex-1 border-t border-border" />
          </div>

          {areaObjs.map((obj: any) => {
            const objKRs = (keyResults || []).filter((kr) => kr.objective_id === obj.id);
            const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
            const sortedKRs = [...objKRs].sort((a, b) => {
              if (!currentCycle) return 0;
              return statusOrder(getKRStatus(a, currentCycle, milestonesMap[a.id], checkinsMap[a.id])) - statusOrder(getKRStatus(b, currentCycle, milestonesMap[b.id], checkinsMap[b.id]));
            });

            const canEdit = currentUser?.role === "owner" || (currentUser?.role === "admin" && obj.area_id && currentUserAreaIds.includes(obj.area_id));
            const isExpanded = expandedIds.has(obj.id);

            return (
              <Card key={obj.id} className="animate-fade-in">
                <CardHeader
                  className="pb-3 cursor-pointer select-none"
                  onClick={() => toggleExpanded(obj.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {obj.external_id && (
                          <span className="text-xs font-mono text-muted-foreground">{obj.external_id}</span>
                        )}
                        {obj.areas?.name && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {obj.areas.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{obj.title}</CardTitle>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => { e.stopPropagation(); setEditObj(obj); }}
                              title="Editar objetivo"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteObj(obj); }}
                              title="Excluir objetivo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                      {obj.description && <p className="text-sm text-muted-foreground mt-1">{obj.description}</p>}
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
