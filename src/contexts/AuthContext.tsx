import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

type AppUser = Tables<"app_users">;

interface AuthContextType {
  authUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  appUser: null,
  loading: true,
  error: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ALLOWED_DOMAINS = ["gocase.com", "gobeaute.com"];

function getEmailDomain(email: string): string {
  return email.split("@")[1] || "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function resolveAppUser(user: User) {
    const email = user.email;
    if (!email) {
      setError("Não foi possível obter o email da conta.");
      setAppUser(null);
      setLoading(false);
      return;
    }

    const domain = getEmailDomain(email);
    if (!ALLOWED_DOMAINS.includes(domain)) {
      setError("Acesso permitido apenas para contas corporativas.");
      setAppUser(null);
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("app_users")
      .select("*")
      .eq("email", email)
      .eq("archived", false)
      .maybeSingle();

    if (dbError) {
      setError("Erro ao verificar cadastro. Tente novamente.");
      setAppUser(null);
    } else if (!data) {
      setError("Seu usuário não está cadastrado no sistema. Procure um administrador.");
      setAppUser(null);
    } else {
      setError(null);
      setAppUser(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      if (user) {
        resolveAppUser(user);
      } else {
        setAppUser(null);
        setError(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setAuthUser(user);
      if (user) {
        resolveAppUser(user);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setAuthUser(null);
    setAppUser(null);
    setError(null);
  }

  return (
    <AuthContext.Provider value={{ authUser, appUser, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
