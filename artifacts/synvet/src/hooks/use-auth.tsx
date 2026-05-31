import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
    clinicName: string,
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Mensagem amigável para falhas de REDE ao falar com o Supabase (ex.: projeto
 * Supabase pausado/indisponível, sem internet, DNS bloqueado). Nesses casos o
 * SDK lança `TypeError: Failed to fetch` em vez de devolver `{ error }`, o que
 * antes resultava em "nada acontece" na tela de login.
 */
function connectionErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/fetch|network|load failed/i.test(raw)) {
    return "Não foi possível conectar ao servidor de login. Verifique sua conexão com a internet e tente novamente. Se o problema persistir, o serviço de autenticação pode estar indisponível.";
  }
  return raw || "Falha inesperada ao entrar. Tente novamente.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch(() => {
        // Falha de rede ao buscar a sessão (ex.: Supabase indisponível). Não
        // podemos travar a UI em "Carregando..." — seguimos como deslogado.
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      configured: supabaseConfigured,
      async signInWithPassword(email, password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          return { error: error?.message ?? null };
        } catch (err) {
          return { error: connectionErrorMessage(err) };
        }
      },
      async signUp(email, password, name, clinicName) {
        try {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, clinic_name: clinicName } },
          });
          return { error: error?.message ?? null };
        } catch (err) {
          return { error: connectionErrorMessage(err) };
        }
      },
      async signOut() {
        try {
          await supabase.auth.signOut();
          return { error: null };
        } catch (err) {
          return { error: connectionErrorMessage(err) };
        }
      },
      async resetPassword(email) {
        if (!supabaseConfigured) {
          return { error: "Supabase não configurado — recuperação indisponível em modo demo." };
        }
        try {
          const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}login`;
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
          return { error: error?.message ?? null };
        } catch (err) {
          return { error: connectionErrorMessage(err) };
        }
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
