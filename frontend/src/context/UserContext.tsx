import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError } from "../services/api";
import {
  type AuthUser,
  exchangeAuthCode,
  fetchMe,
  loginWithEmail,
  patchMe,
  registerWithEmail,
  requestPasswordReset,
  resetPasswordWithCode,
  startGoogleSignIn,
} from "../services/auth";

export type UserProfile = {
  id: string | null;
  name: string;
  email: string | null;
  picture: string | null;
  isPro: boolean;
  isAuthenticated: boolean;
  authProvider: "google" | "email" | null;
  notificationsEnabled: boolean;
  subscriptionStartedAt: string | null;
};

type UserContextValue = UserProfile & {
  token: string | null;
  hydrated: boolean;
  authBusy: boolean;
  authError: string | null;
  setName: (name: string) => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmailPassword: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (
    email: string,
    code: string,
    password: string,
  ) => Promise<boolean>;
  completeAuthFromCode: (code: string) => Promise<boolean>;
  signOut: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  resetProfile: () => void;
};

const PROFILE_KEY = "@mystix_user_v1";
const TOKEN_KEY = "@mystix_access_token_v1";

const DEFAULT_PROFILE: UserProfile = {
  id: null,
  name: "Гость",
  email: null,
  picture: null,
  isPro: false,
  isAuthenticated: false,
  authProvider: null,
  notificationsEnabled: true,
  subscriptionStartedAt: null,
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

function profileFromUser(user: AuthUser): UserProfile {
  return {
    id: user.id,
    name: user.name || "Гость",
    email: user.email,
    picture: user.picture,
    isPro: user.is_pro,
    isAuthenticated: true,
    authProvider: user.auth_provider === "email" ? "email" : "google",
    notificationsEnabled: user.notifications_enabled,
    subscriptionStartedAt: null,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [token, setToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const applySession = useCallback(async (accessToken: string, user: AuthUser) => {
    const next = profileFromUser(user);
    setToken(accessToken);
    setProfile(next);
    setAuthError(null);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, accessToken],
      [PROFILE_KEY, JSON.stringify(next)],
    ]);
  }, []);

  useEffect(() => {
    (async () => {
      let savedToken: string | null = null;
      try {
        const [[, storedToken], [, rawProfile]] = await AsyncStorage.multiGet([
          TOKEN_KEY,
          PROFILE_KEY,
        ]);
        savedToken = storedToken;
        if (rawProfile) {
          const parsed = {
            ...DEFAULT_PROFILE,
            ...(JSON.parse(rawProfile) as Partial<UserProfile>),
          };
          if (!savedToken) {
            parsed.id = null;
            parsed.isAuthenticated = false;
            parsed.authProvider = null;
            parsed.email = null;
            parsed.picture = null;
          }
          setProfile(parsed);
        }
        if (savedToken) {
          setToken(savedToken);
        }
      } catch {
        setProfile(DEFAULT_PROFILE);
        setToken(null);
        savedToken = null;
      } finally {
        setHydrated(true);
      }

      if (!savedToken) return;
      try {
        const user = await fetchMe(savedToken);
        await applySession(savedToken, user);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await AsyncStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setProfile((current) => ({
            ...current,
            id: null,
            isAuthenticated: false,
            authProvider: null,
            email: null,
            picture: null,
          }));
        }
      }
    })();
  }, [applySession]);

  useEffect(() => {
    if (!hydrated || token) return;
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [hydrated, profile, token]);

  const completeAuthFromCode = useCallback(
    async (code: string) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await exchangeAuthCode(code);
        await applySession(session.access_token, session.user);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось войти через Google";
        setAuthError(message);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession],
  );

  const signInWithGoogle = useCallback(async () => {
    if (authBusy) return false;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await startGoogleSignIn();
      await applySession(session.access_token, session.user);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "AuthCancelled") {
        return false;
      }
      const message =
        error instanceof Error ? error.message : "Не удалось войти через Google";
      setAuthError(message);
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [applySession, authBusy]);

  const runEmailAuth = useCallback(
    async (task: () => Promise<{ access_token: string; user: AuthUser }>) => {
      if (authBusy) return false;
      setAuthBusy(true);
      setAuthError(null);
      try {
        const session = await task();
        await applySession(session.access_token, session.user);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Не удалось войти";
        setAuthError(message);
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [applySession, authBusy],
  );

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      runEmailAuth(() => loginWithEmail({ email, password })),
    [runEmailAuth],
  );

  const registerWithEmailPassword = useCallback(
    (email: string, password: string, name?: string) =>
      runEmailAuth(() => registerWithEmail({ email, password, name })),
    [runEmailAuth],
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    if (authBusy) return false;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await requestPasswordReset(email);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось отправить код";
      setAuthError(message);
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [authBusy]);

  const resetPassword = useCallback(
    (email: string, code: string, password: string) =>
      runEmailAuth(() => resetPasswordWithCode({ email, code, password })),
    [runEmailAuth],
  );

  const signOut = useCallback(() => {
    setToken(null);
    setAuthError(null);
    setProfile((current) => ({
      ...DEFAULT_PROFILE,
      notificationsEnabled: current.notificationsEnabled,
    }));
    AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  }, []);

  const setName = useCallback(
    (name: string) => {
      const normalized = name.trim();
      if (!normalized) return;
      setProfile((current) => ({ ...current, name: normalized }));
      if (token) {
        patchMe(token, { name: normalized }).catch(() => {});
      }
    },
    [token],
  );

  const setNotificationsEnabled = useCallback(
    (notificationsEnabled: boolean) => {
      setProfile((current) => ({ ...current, notificationsEnabled }));
      if (token) {
        patchMe(token, { notifications_enabled: notificationsEnabled }).catch(() => {});
      }
    },
    [token],
  );

  const resetProfile = useCallback(() => {
    setToken(null);
    setProfile(DEFAULT_PROFILE);
    AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      ...profile,
      token,
      hydrated,
      authBusy,
      authError,
      setName,
      signInWithGoogle,
      signInWithEmail,
      registerWithEmailPassword,
      sendPasswordReset,
      resetPassword,
      completeAuthFromCode,
      signOut,
      setNotificationsEnabled,
      resetProfile,
    }),
    [
      authBusy,
      authError,
      completeAuthFromCode,
      hydrated,
      profile,
      resetProfile,
      setName,
      setNotificationsEnabled,
      signInWithEmail,
      signInWithGoogle,
      registerWithEmailPassword,
      resetPassword,
      sendPasswordReset,
      signOut,
      token,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const value = useContext(UserContext);
  if (!value) throw new Error("useUser must be used inside UserProvider");
  return value;
}
