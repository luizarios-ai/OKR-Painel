import React, { createContext, useContext, useState, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AppUser = Tables<"app_users">;
type Cycle = Tables<"cycles">;

interface AppContextType {
  currentUser: AppUser | null;
  setCurrentUser: (u: AppUser | null) => void;
  currentCycle: Cycle | null;
  setCycle: (c: Cycle | null) => void;
  users: AppUser[];
  cycles: Cycle[];
  loading: boolean;
  /** Area IDs the current user is linked to */
  currentUserAreaIds: string[];
}

const AppContext = createContext<AppContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  currentCycle: null,
  setCycle: () => {},
  users: [],
  cycles: [],
  loading: true,
  currentUserAreaIds: [],
});

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(appUser);
  const [currentCycle, setCycle] = useState<Cycle | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserAreaIds, setCurrentUserAreaIds] = useState<string[]>([]);

  // Load areas for current user whenever it changes
  useEffect(() => {
    if (!currentUser) {
      setCurrentUserAreaIds([]);
      return;
    }
    supabase
      .from("user_areas")
      .select("area_id")
      .eq("user_id", currentUser.id)
      .then(({ data }) => {
        setCurrentUserAreaIds((data || []).map((r: any) => r.area_id));
      });
  }, [currentUser?.id]);

  useEffect(() => {
    async function load() {
      const [usersRes, cyclesRes] = await Promise.all([
        supabase.from("app_users").select("*").eq("archived", false),
        supabase.from("cycles").select("*").order("start_date", { ascending: false }),
      ]);
      const u = usersRes.data || [];
      const c = cyclesRes.data || [];
      setUsers(u);
      setCycles(c);

      if (appUser) {
        const found = u.find((x) => x.id === appUser.id);
        if (found) setCurrentUser(found);
      }

      if (c.length > 0) setCycle(c[0]);
      setLoading(false);
    }
    load();
  }, [appUser]);

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, currentCycle: currentCycle, setCycle, users, cycles, loading, currentUserAreaIds }}>
      {children}
    </AppContext.Provider>
  );
}
