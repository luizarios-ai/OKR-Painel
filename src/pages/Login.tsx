import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn, AlertCircle } from "lucide-react";

export default function Login() {
  const { error, loading, authUser } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function handleGoogleLogin() {
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: "*",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      console.error("OAuth error:", error);
    }
    setSigningIn(false);
  }

  const showError = error && authUser;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-primary">Painel de OKRs</span> Gogroup
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestão de OKRs — Gogroup
          </p>
        </div>

        {showError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-left text-sm text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          size="lg"
          className="w-full gap-3 text-base"
          onClick={handleGoogleLogin}
          disabled={signingIn || loading}
        >
          <LogIn className="h-5 w-5" />
          {signingIn ? "Redirecionando..." : "Entrar com Google"}
        </Button>

        <p className="text-xs text-muted-foreground">
          Acesso restrito a colaboradores Gogroup.
        </p>
      </div>
    </div>
  );
}
