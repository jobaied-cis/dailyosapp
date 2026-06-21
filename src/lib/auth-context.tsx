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
 * DailyOS Auth foundation.
 *
 * Spec mapping (React Native → Web):
 *  - AsyncStorage     → localStorage
 *  - createStackNavigator → TanStack Router file-based routes + a root switch
 *    (Onboarding | AuthStack | AppStack) driven by this context.
 *
 * No UI logic lives here — only state, persistence, and actions.
 */

export type UserProfile = {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
} | null;

type AuthState = {
  isFirstTime: boolean;
  isLoggedIn: boolean;
  userProfile: UserProfile;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (profile?: NonNullable<UserProfile>) => void;
  logout: () => void;
  completeOnboarding: () => void;
  setUserProfile: (profile: UserProfile) => void;
};

const STORAGE_KEYS = {
  isFirstTime: "dailyos.auth.isFirstTime",
  isLoggedIn: "dailyos.auth.isLoggedIn",
  userProfile: "dailyos.auth.userProfile",
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start in loading state; hydrate from storage on mount (SSR-safe).
  const [state, setState] = useState<AuthState>({
    isFirstTime: true,
    isLoggedIn: false,
    userProfile: null,
    loading: true,
  });

  // Hydrate on app start (mirrors AsyncStorage load in RN spec).
  useEffect(() => {
    const isFirstTime = readBool(STORAGE_KEYS.isFirstTime, true);
    const isLoggedIn = readBool(STORAGE_KEYS.isLoggedIn, false);
    const userProfile = readJSON<UserProfile>(STORAGE_KEYS.userProfile, null);
    setState({ isFirstTime, isLoggedIn, userProfile, loading: false });
  }, []);

  const completeOnboarding = useCallback(() => {
    safeSet(STORAGE_KEYS.isFirstTime, "false");
    setState((s) => ({ ...s, isFirstTime: false }));
  }, []);

  const login = useCallback((profile?: NonNullable<UserProfile>) => {
    const nextProfile: UserProfile = profile ?? {
      id: `local-${Date.now()}`,
      name: "Guest",
    };
    safeSet(STORAGE_KEYS.isLoggedIn, "true");
    safeSet(STORAGE_KEYS.userProfile, JSON.stringify(nextProfile));
    // Logging in also implies onboarding has been seen.
    safeSet(STORAGE_KEYS.isFirstTime, "false");
    setState((s) => ({
      ...s,
      isLoggedIn: true,
      userProfile: nextProfile,
      isFirstTime: false,
    }));
  }, []);

  const logout = useCallback(() => {
    safeSet(STORAGE_KEYS.isLoggedIn, "false");
    safeRemove(STORAGE_KEYS.userProfile);
    setState((s) => ({ ...s, isLoggedIn: false, userProfile: null }));
  }, []);

  const setUserProfile = useCallback((profile: UserProfile) => {
    if (profile) {
      safeSet(STORAGE_KEYS.userProfile, JSON.stringify(profile));
    } else {
      safeRemove(STORAGE_KEYS.userProfile);
    }
    setState((s) => ({ ...s, userProfile: profile }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      completeOnboarding,
      setUserProfile,
    }),
    [state, login, logout, completeOnboarding, setUserProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
