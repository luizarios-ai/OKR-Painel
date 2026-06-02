import type { Tables } from "@/integrations/supabase/types";
import { expectedProgressKR, type OKRStatus } from "./okr-utils";

type Cycle = Tables<"cycles">;
type KeyResult = Tables<"key_results"> & { expected_progress_mode?: string };
type Milestone = Tables<"milestones">;
type Checkin = { id: string; key_result_id: string; value: number; comment: string | null; created_at: string; reference_month?: string };

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

export interface MonthBucket {
  key: string;
  label: string;
  value: number | null;
  /** cumulative progress 0-1, or null if no checkin up to this month */
  progress: number | null;
  expected: number;
  status: OKRStatus | "no-update";
  comment: string | null;
}

/** Valid months: January (0) to June (5) only */
const VALID_MONTH_INDICES = new Set([0, 1, 2, 3, 4, 5]);

/** Generate month keys between cycle start and end, restricted to Jan-Jun.
 *  Only includes months up to the month BEFORE the current one (inclusive).
 *  e.g. if today is April → includes Jan, Feb, Mar */
export function getCycleMonths(cycle: Cycle): { key: string; label: string; endOfMonth: Date }[] {
  const start = new Date(cycle.start_date);
  const end = new Date(cycle.end_date);
  const months: { key: string; label: string; endOfMonth: Date }[] = [];
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const now = new Date();
  // Last month to evaluate: the month before current
  const limitYear = now.getFullYear();
  const limitMonth = now.getMonth() - 1; // 0-based, e.g. April(3) → limit is March(2)
  
  let y = start.getFullYear();
  let m = start.getMonth();
  
  while (true) {
    // Stop if we've gone past the limit (month before current)
    if (y > limitYear || (y === limitYear && m > limitMonth)) break;

    if (VALID_MONTH_INDICES.has(m)) {
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = labels[m];
      const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
      months.push({ key, label, endOfMonth });
    }
    
    if (y > end.getFullYear() || (y === end.getFullYear() && m >= end.getMonth())) break;
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

function cumulativeProgressFromValue(kr: KeyResult, accumulated: number): number {
  if (kr.grade1_value === 0) return 0;
  if (kr.direction === "increase") {
    return clamp(accumulated / kr.grade1_value);
  }
  return clamp(1 - accumulated / kr.grade1_value);
}

function getStatusFromProgress(progress: number, expected: number): OKRStatus {
  if (progress >= 1) return "completed";
  if (expected === 0) return "on-track";
  if (progress < expected * 0.4) return "off-track";
  if (progress < expected * 0.7) return "at-risk";
  return "on-track";
}

/** Build monthly evolution for a single KR using cumulative progress */
export function buildMonthlyEvolution(
  kr: KeyResult,
  cycle: Cycle,
  checkins: Checkin[],
  milestones?: Milestone[]
): MonthBucket[] {
  const months = getCycleMonths(cycle);
  
  // Group checkins by month key — SUM all values per month, collect last comment
  const sumByMonth: Record<string, number> = {};
  const commentByMonth: Record<string, string | null> = {};
  
  for (const c of checkins) {
    const key = c.reference_month || (() => {
      const d = new Date(c.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    sumByMonth[key] = (sumByMonth[key] || 0) + c.value;
    if (c.comment) commentByMonth[key] = c.comment; // last non-null comment wins
  }

  // Build cumulative sum across months in order
  let cumulativeSum = 0; // progress starts from 0, grade0 is informational

  return months.map(({ key, label, endOfMonth }) => {
    const monthValue = sumByMonth[key];
    const expected = expectedProgressKR(kr, cycle, milestones, endOfMonth);

    if (monthValue !== undefined) {
      cumulativeSum += monthValue;
      const progress = cumulativeProgressFromValue(kr, cumulativeSum);
      const status = getStatusFromProgress(progress, expected);
      return { key, label, value: monthValue, progress, expected, status, comment: commentByMonth[key] || null };
    }

    // No checkin for this month - show no-update
    return { key, label, value: null, progress: null, expected, status: "no-update" as const, comment: null };
  });
}

/** Build sparkline data (cumulative progress values per month) for a KR */
export function buildSparkline(
  kr: KeyResult,
  cycle: Cycle,
  checkins: Checkin[]
): (number | null)[] {
  const months = getCycleMonths(cycle);
  
  const sumByMonth: Record<string, number> = {};
  for (const c of checkins) {
    const key = c.reference_month || (() => {
      const d = new Date(c.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    sumByMonth[key] = (sumByMonth[key] || 0) + c.value;
  }
  
  let cumulativeSum = 0;
  
  return months.map(({ key }) => {
    const val = sumByMonth[key];
    if (val === undefined) return null;
    cumulativeSum += val;
    return cumulativeProgressFromValue(kr, cumulativeSum);
  });
}
