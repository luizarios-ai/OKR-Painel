import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Globe, Settings, Plus, LogOut, ChevronDown, ChevronRight,
  Building2, Target, Sun, Moon, ChevronLeft, ChevronRight as ChevronRightIcon, BookOpen
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTheme, setTheme } from "@/lib/theme";

const SIDEBAR_BG_LIGHT = "#2659a5";
const SIDEBAR_BG_DARK = "#080e1a";

const ACCENT = "#d7d900";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, currentCycle, setCycle, users, cycles, areas, currentUserAreaIds, selectedOKRAreaId, setSelectedOKRAreaId } = useApp();
  const { signOut, appUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(getTheme() === "dark");
  const [okrsOpen, setOkrsOpen] = useState(false);

  // On first load, redirect to dashboard if on /okrs
  useEffect(() => {
    if (!sessionStorage.getItem("app_init")) {
      sessionStorage.setItem("app_init", "1");
      if (location.pathname.startsWith("/okrs")) navigate("/");
    }
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const role = currentUser?.role || "viewer";
  const canCreate = role === "admin" || role === "owner";
  const isOnOKRs = location.pathname.startsWith("/okrs") || location.pathname.startsWith("/kr/") || location.pathname.startsWith("/criar-okr");

  useEffect(() => { setTheme(dark ? "dark" : "light"); }, [dark]);

  // Visible areas for OKR sidebar
  const visibleAreas = role === "owner"
    ? areas
    : areas.filter((a) => currentUserAreaIds.includes(a.id));

  const sidebarLink = (to: string, label: string, icon: React.ReactNode, exact = false) => {
    const active = exact ? location.pathname === to : location.pathname.startsWith(to);
    return (
      <Link to={to}
        style={{
          display: "flex", alignItems: "center", gap: collapsed ? 0 : 10,
          padding: collapsed ? "10px 0" : "9px 12px",
          borderRadius: 8, fontSize: 14, fontWeight: 500,
          color: active ? "#ffffff" : "#daeaff",
          background: active ? ACCENT : "transparent",
          transition: "all 0.15s",
          justifyContent: collapsed ? "center" : "flex-start",
          textDecoration: "none",
        }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = SIDEBAR_HOVER; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#daeaff"; }}}
      >
        <span style={{ flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  return (
    <div className="bg-background" style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar */}
      <aside style={{
        width: collapsed ? 56 : 240, minWidth: collapsed ? 56 : 240,
        background: dark ? "#080e1a" : "#2659a5", display: "flex", flexDirection: "column",
        transition: "width 0.2s", overflow: "hidden", position: "relative",
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? "20px 12px" : "20px 16px", borderBottom: "1px solid #1e2a45", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
          {!collapsed && (
            <div>
              <div style={{ color: ACCENT, fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>Painel de OKRs</div>
              <div style={{ color: "#b8d0f0", fontSize: 12, marginTop: 2 }}>Gogroup</div>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b8d0f0", padding: 4, borderRadius: 4, display: "flex" }}>
            {collapsed ? <ChevronRightIcon size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Cycle selector */}
        {!collapsed && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2a45" }}>
            <Select value={currentCycle?.id || ""} onValueChange={(v) => setCycle(cycles.find((c) => c.id === v) || null)}>
              <SelectTrigger style={{ background: dark ? "#1a3060" : "#1e4a8a", border: "1px solid #2d3f5e", color: "#e2e8f0", fontSize: 13, height: 32 }}>
                <SelectValue placeholder="Ciclo" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: collapsed ? "8px 4px" : "8px 10px", overflowY: "auto", overflowX: "hidden" }}>
          {sidebarLink("/", collapsed ? "" : "Dashboard", <LayoutDashboard size={16} />, true)}

          {sidebarLink("/diretrizes", collapsed ? "" : "Diretrizes 2026.2", <BookOpen size={16} />)}
          {/* OKRs section */}
          {(role === "admin" || role === "owner") && (
            <div>
              <button
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: collapsed ? "10px 0" : "9px 12px", borderRadius: 8,
                  background: isOnOKRs && !selectedOKRAreaId ? ACCENT : "transparent",
                  color: isOnOKRs && !selectedOKRAreaId ? "#ffffff" : "#daeaff",
                  border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                  justifyContent: collapsed ? "center" : "flex-start",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { if (!(isOnOKRs && !selectedOKRAreaId)) { (e.currentTarget as HTMLElement).style.background = SIDEBAR_HOVER; (e.currentTarget as HTMLElement).style.color = "#fff"; }}}
                onMouseLeave={e => { if (!(isOnOKRs && !selectedOKRAreaId)) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#daeaff"; }}}
                onClick={() => {
                  setOkrsOpen(!okrsOpen);
                  if (!collapsed) {
                    setSelectedOKRAreaId(null);
                    navigate("/okrs");
                  }
                }}
              >
                <Target size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>OKRs</span>}
                {!collapsed && (okrsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
              </button>

              {/* Areas list */}
              {okrsOpen && !collapsed && visibleAreas.length > 0 && (
                <div style={{ marginLeft: 16, marginTop: 2, borderLeft: "1px solid #1e2a45", paddingLeft: 8 }}>
                  {visibleAreas.map((area) => {
                    const active = selectedOKRAreaId === area.id && isOnOKRs;
                    return (
                      <button
                        key={area.id}
                        onClick={() => {
                          setSelectedOKRAreaId(area.id);
                          navigate("/okrs");
                        }}
                        style={{
                          width: "100%", textAlign: "left", padding: "7px 10px",
                          borderRadius: 6, fontSize: 13.5, border: "none", cursor: "pointer",
                          background: active ? ACCENT : "transparent",
                          color: active ? "#ffffff" : "#b8d0f0",
                          fontWeight: active ? 600 : 400,
                          transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6,
                        }}
                        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = SIDEBAR_HOVER; (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; }}}
                        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#b8d0f0"; }}}
                      >
                        <Building2 size={11} style={{ flexShrink: 0 }} />
                        <span style={{ lineHeight: 1.3 }}>{area.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(role === "admin" || role === "owner") && sidebarLink("/admin", collapsed ? "" : "Admin", <Settings size={16} />)}
        </nav>

        {/* Bottom */}
        <div style={{ padding: collapsed ? "8px 4px" : "8px 10px", borderTop: "1px solid #1e2a45" }}>
          {canCreate && !collapsed && (
            <button
              onClick={() => navigate("/criar-okr")}
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, border: "none",
                background: ACCENT, color: "#1a1a00", fontSize: 13, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                justifyContent: "center",
              }}
            >
              <Plus size={14} /> Novo OKR
            </button>
          )}

          {/* Owner user switcher */}
          {role === "owner" && !collapsed && (
            <div style={{ marginBottom: 8 }}>
              <Select value={currentUser?.id || ""} onValueChange={(v) => setCurrentUser(users.find((u) => u.id === v) || null)}>
                <SelectTrigger style={{ background: dark ? "#1a3060" : "#1e4a8a", border: "1px solid #2d3f5e", color: "#e2e8f0", fontSize: 12, height: 28 }}>
                  <SelectValue placeholder="Visualizar como..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 4 }}>
            {!collapsed && <span style={{ color: "#c8def5", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{appUser?.name}</span>}
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b8d0f0", padding: 4, borderRadius: 4, display: "flex" }}>
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button onClick={signOut} title="Sair" style={{ background: "none", border: "none", cursor: "pointer", color: "#b8d0f0", padding: 4, borderRadius: 4, display: "flex" }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <main className="bg-background" style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
