import { useMemo, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useObjectives, useKeyResults, useMilestones, useAreas, useAllCheckins } from "@/hooks/useOKRData";
import { progressKR, progressObjective, getKRStatus, getObjectiveStatus, expectedProgress, formatPercent, statusOrder, statusLabel, type OKRStatus } from "@/lib/okr-utils";
import StatusBadge from "@/components/okr/StatusBadge";
import ProgressBar from "@/components/okr/ProgressBar";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Building2, ChevronDown, X } from "lucide-react";

const ALL_STATUSES: OKRStatus[] = ["off-track", "at-risk", "on-track", "completed"];
const CV_STATUS_KEY = "okrflow-cv-status-filter";

export default function CompanyView() {
  const { currentCycle } = useApp();
  const { data: objectives } = useObjectives(currentCycle?.id);
  const { data: keyResults } = useKeyResults(currentCycle?.id);
  const { data: areas } = useAreas();
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<OKRStatus[]>(() => {
    try { const raw = localStorage.getItem(CV_STATUS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  const krIds = useMemo(() => (keyResults || []).filter((kr) => kr.has_milestones).map((kr) => kr.id), [keyResults]);
  const allKrIds = useMemo(() => (keyResults || []).map((kr) => kr.id), [keyResults]);
  const { data: milestones } = useMilestones(krIds);
  const { data: allCheckins } = useAllCheckins(currentCycle?.id, allKrIds);

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

  const expected = currentCycle ? expectedProgress(currentCycle) : 0;

  const filteredObjectives = useMemo(() => {
    if (!objectives || !keyResults) return [];
    return objectives.filter((obj: any) => {
      if (areaFilter !== "all" && obj.area_id !== areaFilter) return false;
      if (statusFilter.length > 0 && currentCycle) {
        const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id);
        const objStatus = getObjectiveStatus(objKRs, currentCycle, milestonesMap, checkinsMap);
        if (!statusFilter.includes(objStatus)) return false;
      }
      return true;
    });
  }, [objectives, keyResults, areaFilter, statusFilter, currentCycle, milestonesMap, checkinsMap]);

  // Group by area
  const grouped = useMemo(() => {
    const map: Record<string, { area: string; objectives: any[] }> = {};
    filteredObjectives.forEach((obj: any) => {
      const areaName = obj.areas?.name || "Sem Área";
      if (!map[areaName]) map[areaName] = { area: areaName, objectives: [] };
      map[areaName].objectives.push(obj);
    });
    return Object.values(map);
  }, [filteredObjectives]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> Visão Empresa
            {filteredObjectives.length > 0 && keyResults && currentCycle && (
              <Badge variant="secondary" className="text-base font-bold px-3 py-1">
                {formatPercent(
                  filteredObjectives.filter((o: any) => !o.archived).reduce((sum: number, obj: any) => {
                    const objKRs = (keyResults || []).filter((kr: any) => kr.objective_id === obj.id && !kr.archived);
                    return sum + progressObjective(objKRs, milestonesMap, checkinsMap);
                  }, 0) / Math.max(filteredObjectives.filter((o: any) => !o.archived).length, 1)
                )}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">Ciclo {currentCycle?.name} · Somente leitura</p>
        </div>
        <div className="flex gap-2">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Áreas</SelectItem>
              {(areas || []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
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
                        localStorage.setItem(CV_STATUS_KEY, JSON.stringify(next));
                      }}
                    />
                    {statusLabel(s)}
                  </label>
                ))}
              </div>
              {statusFilter.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => { setStatusFilter([]); localStorage.removeItem(CV_STATUS_KEY); }}>
                  <X className="h-3 w-3 mr-1" /> Limpar
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.area}>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {group.area}
          </h2>
          <div className="space-y-4">
            {group.objectives.map((obj: any) => {
              const objKRs = (keyResults || []).filter((kr) => kr.objective_id === obj.id);
              const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
              return (
                <Card key={obj.id} className="animate-fade-in">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                          <span className="font-mono">{obj.external_id}</span>
                          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{obj.areas?.name}</span>
                        </div>
                        <h3 className="font-semibold">{obj.title}</h3>
                      </div>
                      <span className="text-xl font-bold shrink-0">{formatPercent(objProgress)}</span>
                    </div>
                    <ProgressBar
                      progress={objProgress}
                      status={objProgress >= expected * 0.7 ? "on-track" : objProgress >= expected * 0.4 ? "at-risk" : "off-track"}
                      expected={expected}
                      className="mb-4"
                    />
                    <div className="space-y-2">
                      {objKRs.sort((a, b) => {
                        if (!currentCycle) return 0;
                        return statusOrder(getKRStatus(a, currentCycle, milestonesMap[a.id], checkinsMap[a.id])) - statusOrder(getKRStatus(b, currentCycle, milestonesMap[b.id], checkinsMap[b.id]));
                      }).map((kr: any) => {
                        const p = progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]);
                        const s = getKRStatus(kr, currentCycle!, milestonesMap[kr.id], checkinsMap[kr.id]);
                        return (
                          <div key={kr.id} className="flex items-center gap-3 p-2 rounded-md">
                            <StatusBadge status={s} />
                            <span className="flex-1 text-sm truncate">{kr.title}</span>
                            <span className="text-sm font-semibold">{formatPercent(p)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
