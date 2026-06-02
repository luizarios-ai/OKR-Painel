import type { Tables } from "@/integrations/supabase/types";

type Cycle = Tables<"cycles">;
type KeyResult = Tables<"key_results"> & { expected_progress_mode?: string; measurement_type?: string };
type Milestone = Tables<"milestones">;
type CheckinRecord = { id: string; key_result_id: string; value: number; milestone_id?: string | null };

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function expectedProgress(cycle: Cycle, now = new Date()): number {
  const start = new Date(cycle.start_date).getTime();
  const end = new Date(cycle.end_date).getTime();
  const current = now.getTime();
  if (end <= start) return 0;
  return clamp((current - start) / (end - start));
}

export function expectedProgressKR(
  kr: KeyResult,
  cycle: Cycle,
  milestones?: Milestone[],
  now = new Date()
): number {
  if (
    kr.expected_progress_mode === "milestone_dates" &&
    kr.has_milestones &&
    milestones &&
    milestones.length > 0
  ) {
    const today = now.getTime();
    return milestones.reduce((sum, m) => {
      if (!m.due_date) return sum;
      const due = new Date(m.due_date).getTime();
      return due <= today ? sum + m.weight : sum;
    }, 0);
  }
  return expectedProgress(cycle, now);
}

/**
 * Calculate KR progress using cumulative sum of all checkin values.
 * For milestone-based KRs, uses weighted milestone progress.
 */
export function progressKR(kr: KeyResult, milestones?: Milestone[], checkins?: CheckinRecord[]): number {
  if (kr.has_milestones && milestones && milestones.length > 0) {
    const sumResults = milestones.reduce((sum, m) => sum + (m.current_value ?? 0), 0);
    if (kr.grade1_value === 0) return 0;
    return clamp(sumResults / kr.grade1_value);
  }

  // New formula: progress = accumulated / grade1 (Grade 0 is informational only)
  if (checkins && checkins.length > 0) {
    const accumulated = checkins.reduce((sum, c) => sum + c.value, 0);
    if (kr.grade1_value === 0) return 0;

    // Average measurement type: progress = average of checkin values / grade1
    if (kr.measurement_type === "average") {
      const avg = accumulated / checkins.length;
      if (kr.direction === "increase") {
        return clamp(avg / kr.grade1_value);
      }
      return clamp(1 - avg / kr.grade1_value);
    }

    // Accumulated (default)
    if (kr.direction === "increase") {
      return clamp(accumulated / kr.grade1_value);
    }
    // decrease: progress increases as value decreases from grade1 toward 0
    return clamp(1 - accumulated / kr.grade1_value);
  }

  // Fallback to current_value if no checkins provided
  if (kr.current_value == null) return 0;
  if (kr.grade1_value === 0) return 0;
  if (kr.direction === "increase") {
    return clamp(kr.current_value / kr.grade1_value);
  }
  return clamp(1 - kr.current_value / kr.grade1_value);
}

export function progressMilestone(m: Milestone): number {
  if (m.current_value == null || m.target_value === 0) return 0;
  return clamp(m.current_value / m.target_value);
}

export function progressObjective(
  krs: KeyResult[],
  milestonesMap: Record<string, Milestone[]>,
  checkinsMap?: Record<string, CheckinRecord[]>
): number {
  const totalWeight = krs.reduce((s, kr) => s + (kr.archived ? 0 : 1), 0);
  if (totalWeight === 0) return 0;
  const sum = krs
    .filter((kr) => !kr.archived)
    .reduce((s, kr) => s + progressKR(kr, milestonesMap[kr.id], checkinsMap?.[kr.id]) * 1, 0);
  return sum / totalWeight;
}

export type OKRStatus = "completed" | "on-track" | "at-risk" | "off-track";

export function getKRStatus(
  kr: KeyResult,
  cycle: Cycle,
  milestones?: Milestone[],
  checkins?: CheckinRecord[],
  now = new Date()
): OKRStatus {
  const progress = progressKR(kr, milestones, checkins);
  if (progress >= 1) return "completed";

  const expected = expectedProgressKR(kr, cycle, milestones, now);

  // If milestone_dates mode and no milestone is due yet, treat as on-track
  if (kr.expected_progress_mode === "milestone_dates" && expected === 0) {
    return "on-track";
  }

  const stagnationDays = cycle.stagnation_days;

  // Check stagnation
  if (kr.last_checkin_at) {
    const lastCheckin = new Date(kr.last_checkin_at).getTime();
    const daysSince = (now.getTime() - lastCheckin) / (1000 * 60 * 60 * 24);
    if (daysSince > stagnationDays) return "off-track";
  } else if (expected > 0.1) {
    // No checkin and cycle has progressed
    return "off-track";
  }

  if (progress < expected * 0.4) return "off-track";
  if (progress < expected * 0.7) return "at-risk";
  return "on-track";
}

/**
 * Calculate milestone status using the same thresholds as KR status.
 */
export function getMilestoneStatus(
  m: Milestone,
  _cycle: Cycle,
  _now = new Date()
): OKRStatus {
  const progress = progressMilestone(m);
  if (progress >= 1) return "completed";

  // Milestone status should reflect achieved vs milestone target directly
  // (e.g. 50% progress => at-risk / "Atenção")
  if (progress < 0.4) return "off-track";
  if (progress < 0.7) return "at-risk";
  return "on-track";
}

export function getObjectiveStatus(
  krs: KeyResult[],
  cycle: Cycle,
  milestonesMap: Record<string, Milestone[]>,
  checkinsMap?: Record<string, CheckinRecord[]>,
): OKRStatus {
  const progress = progressObjective(krs, milestonesMap, checkinsMap);
  if (progress >= 1) return "completed";
  const exp = expectedProgress(cycle);
  if (progress < exp * 0.4) return "off-track";
  if (progress < exp * 0.7) return "at-risk";
  return "on-track";
}

export function statusLabel(status: OKRStatus): string {
  const labels: Record<OKRStatus, string> = {
    "off-track": "Crítico",
    "at-risk": "Atenção",
    "on-track": "No planejado",
    completed: "Completo",
  };
  return labels[status];
}

export function statusOrder(status: OKRStatus): number {
  const order: Record<OKRStatus, number> = {
    "off-track": 0,
    "at-risk": 1,
    "on-track": 2,
    completed: 3,
  };
  return order[status];
}

export function formatValue(value: number | null, unit: string): string {
  if (value == null) return "—";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `R$ ${value.toLocaleString("pt-BR")}`;
  if (unit === "boolean") return value >= 1 ? "Sim" : "Não";
  return value.toLocaleString("pt-BR");
}

export function formatPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}
