import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OKRStatus } from "@/lib/okr-utils";
import { statusLabel } from "@/lib/okr-utils";

const STORAGE_KEY = "okrflow-dashboard-filters";

interface Area {
  id: string;
  name: string;
}

interface FilterState {
  areaIds: string[];
  statuses: OKRStatus[];
}

const ALL_STATUSES: OKRStatus[] = ["off-track", "at-risk", "on-track", "completed"];

function loadFilters(): FilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { areaIds: [], statuses: [] };
}

function saveFilters(f: FilterState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
}

interface Props {
  areas: Area[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export type { FilterState };

export default function DashboardFilters({ areas, filters, onChange }: Props) {
  const toggle = (key: "areaIds" | "statuses", value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    const updated = { ...filters, [key]: next };
    saveFilters(updated);
    onChange(updated);
  };

  const clearArea = () => {
    const updated = { ...filters, areaIds: [] };
    saveFilters(updated);
    onChange(updated);
  };

  const clearStatus = () => {
    const updated = { ...filters, statuses: [] };
    saveFilters(updated);
    onChange(updated);
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* Area Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            Área
            {filters.areaIds.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {filters.areaIds.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {areas.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={filters.areaIds.includes(a.id)}
                  onCheckedChange={() => toggle("areaIds", a.id)}
                />
                {a.name}
              </label>
            ))}
          </div>
          {filters.areaIds.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={clearArea}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Status Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            Status
            {filters.statuses.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {filters.statuses.length}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="space-y-1">
            {ALL_STATUSES.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={filters.statuses.includes(s)}
                  onCheckedChange={() => toggle("statuses", s)}
                />
                {statusLabel(s)}
              </label>
            ))}
          </div>
          {filters.statuses.length > 0 && (
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={clearStatus}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { loadFilters };
