import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUserAreas(userId: string | undefined) {
  return useQuery({
    queryKey: ["user_areas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_areas")
        .select("area_id")
        .eq("user_id", userId!);
      return (data || []).map((r: any) => r.area_id as string);
    },
  });
}

export function useAllUserAreas() {
  return useQuery({
    queryKey: ["all_user_areas"],
    queryFn: async () => {
      const { data } = await supabase.from("user_areas").select("*");
      return data || [];
    },
  });
}
