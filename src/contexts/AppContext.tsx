import React, { createContext, useContext, useState, useEffect } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type AppUser = Tables<"app_users">;
type Cycle = Tables<"cycles">;
type Area = Tables<"areas">;

interface AppContextType {
  currentUser: AppUser | null;
  setCurrentUser: (u: AppUser | null) => void;
  currentCycle: Cycle | null;
  setCycle: (c: Cycle | null) => void;
  users: AppUser[];
  cycles: Cycle[];
  areas: Area[];
  loading: boolean;
  currentUserAreaIds: string[];
  selectedOKRAreaId: string | null;
  setSelectedOKRAreaId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType>({
  currentUser: null,
  setCurrentUser: () => {},
  currentCycle: null,
  setCycle: () => {},
  users: [],
  cycles: [],
  areas: [],
  loading: true,
  currentUserAreaIds: [],
  selectedOKRAreaId: null,
  setSelectedOKRAreaId: () => {},
});

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { appUser } = useAuth();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(appUser);
  const [currentCycle, setCurrentCycleState] = useState<Cycle | null>(null);
  function setCycle(c: Cycle | null) {
    setCurrentCycleState(c);
    if (c) localStorage.setItem("selectedCycleId", c.id);
    else localStorage.removeItem("selectedCycleId");
  }
  const [users, setUsers] = useState<AppUser[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserAreaIds, setCurrentUserAreaIds] = useState<string[]>([]);
  const [selectedOKRAreaId, setSelectedOKRAreaId] = useState<string | null>(
    () => localStorage.getItem("selectedOKRAreaId") || null
  );

  const setSelectedOKRAreaIdPersisted = (id: string | null) => {
    setSelectedOKRAreaId(id);
    if (id) localStorage.setItem("selectedOKRAreaId", id);
    else localStorage.removeItem("selectedOKRAreaId");
  };

  useEffect(() => {
    if (!currentUser) { setCurrentUserAreaIds([]); return; }
    supabase.from("user_areas").select("area_id").eq("user_id", currentUser.id)
      .then(({ data }) => setCurrentUserAreaIds((data || []).map((r: any) => r.area_id)));
  }, [currentUser?.id]);

  useEffect(() => {
    async function load() {
      const [usersRes, cyclesRes, areasRes] = await Promise.all([
        supabase.from("app_users").select("*").eq("archived", false),
        supabase.from("cycles").select("*").order("start_date", { ascending: false }),
        supabase.from("areas").select("*").eq("archived", false).order("name"),
      ]);
      const u = usersRes.data || [];
      const c = cyclesRes.data || [];
      const a = areasRes.data || [];
      setUsers(u);
      setCycles(c);
      // Sort: Global first, then alphabetical
      const sorted = [...a].sort((x, y) => {
        if (x.name === 'Global') return -1;
        if (y.name === 'Global') return 1;
        return x.name.localeCompare(y.name);
      });
      setAreas(sorted);

      if (appUser) {
        const found = u.find((x) => x.id === appUser.id);
        if (found) setCurrentUser(found);
      }

      const savedCycleId = localStorage.getItem("selectedCycleId");
      const savedCycle = savedCycleId ? c.find((x) => x.id === savedCycleId) : null;
      if (savedCycle) setCycle(savedCycle);
      else if (c.length > 0) setCycle(c[0]);
      setLoading(false);
    }
    load();
  }, [appUser]);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, currentCycle, setCycle,
      users, cycles, areas, loading, currentUserAreaIds,
      selectedOKRAreaId, setSelectedOKRAreaId: setSelectedOKRAreaIdPersisted,
    }}>
      {children}
    </AppContext.Provider>
  );
}
