import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("*").eq("archived", false).order("name");
      return data || [];
    },
  });
}

export function useObjectives(cycleId: string | undefined) {
  return useQuery({
    queryKey: ["objectives", cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data } = await supabase
        .from("objectives")
        .select("*, app_users(name), areas(name)")
        .eq("cycle_id", cycleId!)
        .eq("archived", false)
        .order("created_at");
      return data || [];
    },
  });
}

export function useKeyResults(cycleId: string | undefined) {
  return useQuery({
    queryKey: ["key_results", cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data } = await supabase
        .from("key_results")
        .select("*, app_users(name), areas(name)")
        .eq("cycle_id", cycleId!)
        .eq("archived", false)
        .order("created_at");
      return data || [];
    },
  });
}

export function useMilestones(krIds: string[]) {
  return useQuery({
    queryKey: ["milestones", krIds],
    enabled: krIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("milestones")
        .select("*")
        .in("key_result_id", krIds)
        .eq("archived", false)
        .order("created_at");
      return data || [];
    },
  });
}

export function useCheckins(krId: string) {
  return useQuery({
    queryKey: ["checkins", krId],
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("*, app_users(name)")
        .eq("key_result_id", krId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
}

export function useAllCheckins(cycleId: string | undefined, krIds: string[]) {
  return useQuery({
    queryKey: ["all-checkins", cycleId, krIds],
    enabled: !!cycleId && krIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("checkins")
        .select("id, key_result_id, value, comment, created_at, reference_month, milestone_id")
        .in("key_result_id", krIds)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });
}

export function useKRComments(krId: string) {
  return useQuery({
    queryKey: ["kr-comments", krId],
    enabled: !!krId,
    queryFn: async () => {
      const { data } = await supabase
        .from("kr_comments")
        .select("*, app_users(name)")
        .eq("key_result_id", krId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
}
