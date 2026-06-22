import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * DailyOS Auth + Onboarding state.
 *
 * Web version of the RN spec:
 *   AsyncStorage → localStorage
 *
 * No UI, no routing — just state, persistence, and actions.
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
  userProfile: UserProfile;
  introProgress: number;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (profile?: NonNullable<UserProfile>) => void;
  logout: () => void;
  completeOnboarding: () => void;
  setUserProfile: (profile: NonNullable<UserProfile>) => void;
  setIntroProgress: (index: number) => void;
  finishOnboarding: (profile: NonNullable<UserProfile>) => void;
};

const STORAGE_KEYS = {
  isFirstTime: "dailyos.auth.isFirstTime",
  isLoggedIn: "dailyos.auth.isLoggedIn",
  userProfile: "dailyos.auth.userProfile",
  introProgress: "dailyos.auth.introProgress",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readBool(key: string, fallback: boolean): boolean {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readJSON<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function safeRemove(key: string) {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isFirstTime: true,
    isLoggedIn: false,
    userProfile: null,
    introProgress: 0,
    loading: true,
  });

  // Hydrate from localStorage on mount (SSR-safe).
  useEffect(() => {
    const isFirstTime = readBool(STORAGE_KEYS.isFirstTime, true);
    const isLoggedIn = readBool(STORAGE_KEYS.isLoggedIn, false);
    const userProfile = readJSON<UserProfile>(STORAGE_KEYS.userProfile, null);
    const introProgress = readNumber(STORAGE_KEYS.introProgress, 0);
    setState({
      isFirstTime,
      isLoggedIn,
      userProfile,
      introProgress,
      loading: false,
    });
  }, []);

  const login = useCallback((profile?: NonNullable<UserProfile>) => {
    setState((s) => {
      const nextProfile: UserProfile = profile
        ? { ...(s.userProfile ?? {}), ...profile }
        : s.userProfile;
      safeSet(STORAGE_KEYS.isLoggedIn, "true");
      if (nextProfile) {
        safeSet(STORAGE_KEYS.userProfile, JSON.stringify(nextProfile));
      }
      return { ...s, isLoggedIn: true, userProfile: nextProfile };
    });
  }, []);

  const logout = useCallback(() => {
    safeSet(STORAGE_KEYS.isLoggedIn, "false");
    setState((s) => ({ ...s, isLoggedIn: false }));
  }, []);

  const completeOnboarding = useCallback(() => {
    safeSet(STORAGE_KEYS.isFirstTime, "false");
    setState((s) => ({ ...s, isFirstTime: false }));
  }, []);

  const setUserProfile = useCallback((profile: NonNullable<UserProfile>) => {
    setState((s) => {
      const merged: UserProfile = { ...(s.userProfile ?? {}), ...profile };
      safeSet(STORAGE_KEYS.userProfile, JSON.stringify(merged));
      return { ...s, userProfile: merged };
    });
  }, []);

  const setIntroProgress = useCallback((index: number) => {
    const safe = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
    safeSet(STORAGE_KEYS.introProgress, String(safe));
    setState((s) => ({ ...s, introProgress: safe }));
  }, []);

  // Silence unused-var lint for safeRemove (kept for future logout-purge flows).
  void safeRemove;

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      completeOnboarding,
      setUserProfile,
      setIntroProgress,
    }),
    [state, login, logout, completeOnboarding, setUserProfile, setIntroProgress],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
