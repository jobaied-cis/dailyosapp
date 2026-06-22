import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * DailyOS Auth — backed by Supabase.
 * Public API kept compatible with previous localStorage version:
 *   isFirstTime, isLoggedIn, userProfile, introProgress, loading,
 *   logout, completeOnboarding, setUserProfile, setIntroProgress,
 *   finishOnboarding, login (legacy no-op)
 * New async methods:
 *   signInWithEmail, signUpWithEmail, signInWithGoogle
 */

export type UserProfile = {
  name?: string;
  avatar?: string;
  currency?: string;
  priorities?: string[];
} | null;

type AuthState = {
  isFirstTime: boolean;
  isLoggedIn: boolean;
  userId: string | null;
  userProfile: UserProfile;
  introProgress: number;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  // legacy (kept for API compat — no real effect)
  login: (profile?: NonNullable<UserProfile>) => void;
  // real auth
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  // onboarding / profile
  completeOnboarding: () => void;
  setUserProfile: (profile: NonNullable<UserProfile>) => Promise<void>;
  setIntroProgress: (index: number) => void;
  finishOnboarding: (profile: NonNullable<UserProfile>) => Promise<void>;
};

const STORAGE_KEYS = {
  isFirstTime: "dailyos.auth.isFirstTime",
  introProgress: "dailyos.auth.introProgress",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeSet(key: string, value: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function readBool(key: string, fallback: boolean): boolean {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? fallback : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

async function loadProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("name, avatar, currency, priorities")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    name: data.name ?? undefined,
    avatar: data.avatar ?? undefined,
    currency: data.currency ?? undefined,
    priorities: data.priorities ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isFirstTime: true,
    isLoggedIn: false,
    userId: null,
    userProfile: null,
    introProgress: 0,
    loading: true,
  });

  // Track current session synchronously across handlers
  const sessionRef = useRef<Session | null>(null);

  // Hydrate local-only fields (isFirstTime, introProgress) immediately
  useEffect(() => {
    const isFirstTime = readBool(STORAGE_KEYS.isFirstTime, true);
    const introProgress = readNumber(STORAGE_KEYS.introProgress, 0);
    setState((s) => ({ ...s, isFirstTime, introProgress }));
  }, []);

  // Wire Supabase session
  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      sessionRef.current = session;
      if (!session?.user) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isLoggedIn: false,
            userId: null,
            userProfile: null,
            loading: false,
          }));
        }
        return;
      }
      const profile = await loadProfile(session.user.id);
      if (cancelled) return;
      setState((s) => ({
        ...s,
        isLoggedIn: true,
        userId: session.user.id,
        userProfile: profile,
        loading: false,
      }));
    };

    // 1. Subscribe FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Only react to identity transitions; ignore TOKEN_REFRESHED / INITIAL_SESSION noise
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED"
      ) {
        void applySession(session);
      }
    });

    // 2. Then load existing session
    void supabase.auth.getSession().then(({ data }) => applySession(data.session));

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ----------------------------- legacy ----------------------------- */
  const login = useCallback((_profile?: NonNullable<UserProfile>) => {
    // No-op: real auth happens via signInWithEmail / signInWithGoogle.
    if (typeof console !== "undefined") {
      console.warn("[auth] login() is deprecated; use signInWithEmail / signInWithGoogle.");
    }
  }, []);

  /* ----------------------------- real auth -------------------------- */
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message };
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name?: string) => {
      const redirect = hasWindow() ? window.location.origin : undefined;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirect,
          data: name ? { name } : undefined,
        },
      });
      return { error: error?.message };
    },
    [],
  );

  const signInWithGoogle = useCallback(async () => {
    const redirect = hasWindow() ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirect },
    });
    return { error: error?.message };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // session-only UI flags
    try {
      if (hasWindow()) {
        window.sessionStorage.removeItem("dailyos.welcomeBanner");
        window.localStorage.removeItem("dailyos.weeklyReport.firstSeen");
      }
    } catch {
      /* noop */
    }
    // applySession() via onAuthStateChange will clear state
  }, []);

  /* ----------------------------- onboarding ------------------------- */
  const completeOnboarding = useCallback(() => {
    safeSet(STORAGE_KEYS.isFirstTime, "false");
    setState((s) => ({ ...s, isFirstTime: false }));
  }, []);

  const setIntroProgress = useCallback((index: number) => {
    const safe = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
    safeSet(STORAGE_KEYS.introProgress, String(safe));
    setState((s) => ({ ...s, introProgress: safe }));
  }, []);

  const setUserProfile = useCallback(async (profile: NonNullable<UserProfile>) => {
    const uid = sessionRef.current?.user.id;
    if (!uid) {
      // No session yet — stash locally so ProfileSetup can prefill after signup
      setState((s) => ({ ...s, userProfile: { ...(s.userProfile ?? {}), ...profile } }));
      return;
    }
    const merged: UserProfile = { ...(state.userProfile ?? {}), ...profile };
    setState((s) => ({ ...s, userProfile: merged }));
    const { error } = await supabase.from("profiles").upsert(
      {
        id: uid,
        name: merged?.name ?? null,
        avatar: merged?.avatar ?? null,
        currency: merged?.currency ?? null,
        priorities: merged?.priorities ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) console.error("[auth] profile upsert failed:", error.message);
  }, [state.userProfile]);

  const finishOnboarding = useCallback(
    async (profile: NonNullable<UserProfile>) => {
      safeSet(STORAGE_KEYS.isFirstTime, "false");
      setState((s) => ({ ...s, isFirstTime: false }));
      await setUserProfile(profile);
    },
    [setUserProfile],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logout,
      completeOnboarding,
      setUserProfile,
      setIntroProgress,
      finishOnboarding,
    }),
    [
      state,
      login,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      logout,
      completeOnboarding,
      setUserProfile,
      setIntroProgress,
      finishOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
