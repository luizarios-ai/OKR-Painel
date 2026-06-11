import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Diretrizes from "@/pages/Diretrizes";
import Diretrizes from "@/pages/Diretrizes";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { initTheme } from "@/lib/theme";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import OKRs from "@/pages/OKRs";
import KRDetail from "@/pages/KRDetail";
import Admin from "@/pages/Admin";
import CreateOKR from "@/pages/CreateOKR";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

initTheme();

const queryClient = new QueryClient();

function ViewerGuard({ children }: { children: React.ReactNode }) {
  const { currentUser } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const role = currentUser?.role;
    if (role === "viewer") {
      const allowed = ["/"];
      if (!allowed.includes(location.pathname)) {
        navigate("/", { replace: true });
      }
    }
  }, [currentUser, location.pathname, navigate]);

  return <>{children}</>;
}

function AuthGate() {
  const { appUser, loading, authUser, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Not logged in, or logged in but with error (domain/not registered)
  if (!authUser || !appUser) {
    return <Login />;
  }

  return (
    <AppProvider>
      <AppLayout>
        <ViewerGuard>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/okrs" element={<OKRs />} />
            <Route path="/kr/:id" element={<KRDetail />} />
            <Route path="/diretrizes" element={<Diretrizes />} />
            <Route path="/diretrizes" element={<Diretrizes />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/criar-okr" element={<CreateOKR />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ViewerGuard>
      </AppLayout>
    </AppProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
