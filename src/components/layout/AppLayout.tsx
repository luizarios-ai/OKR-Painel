import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Target, Building2, Settings, Sun, Moon, Globe, Plus, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { getTheme, setTheme } from "@/lib/theme";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["viewer", "admin", "owner"] },
  { to: "/okrs", icon: Target, label: "OKRs", roles: ["admin", "owner"] },
  { to: "/empresa", icon: Globe, label: "Visão Empresa", roles: ["viewer", "admin", "owner"] },
  { to: "/admin", icon: Settings, label: "Admin", roles: ["admin", "owner"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, currentCycle, setCycle, users, cycles } = useApp();
  const { signOut, appUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(getTheme() === "dark");
  const role = currentUser?.role || "viewer";
  const canCreate = role === "admin" || role === "owner";

  const navItems = allNavItems.filter((item) => item.roles.includes(role));

  useEffect(() => {
    setTheme(dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-primary">OKR</span> Flow
          </h1>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {canCreate && (
          <div className="px-3 mb-2">
            <Button size="sm" className="w-full" onClick={() => navigate("/criar-okr")}>
              <Plus className="h-4 w-4 mr-2" /> Novo OKR
            </Button>
          </div>
        )}
        <div className="p-4 border-t border-border space-y-3">
          <Select value={currentCycle?.id || ""} onValueChange={(v) => setCycle(cycles.find((c) => c.id === v) || null)}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Ciclo" />
            </SelectTrigger>
            <SelectContent>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {role === "owner" && (
            <Select value={currentUser?.id || ""} onValueChange={(v) => setCurrentUser(users.find((u) => u.id === v) || null)}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? "Claro" : "Escuro"}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
          {appUser && (
            <p className="text-[10px] text-muted-foreground truncate">{appUser.name}</p>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <h1 className="text-lg font-bold"><span className="text-primary">OKR</span> Flow</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {/* Mobile nav */}
        <nav className="md:hidden flex border-b border-border bg-card overflow-x-auto">
          {navItems.map((item) => {
            const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
