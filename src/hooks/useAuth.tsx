"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Capacitor } from "@capacitor/core";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Deep-link the magic link returns to inside the native app. On the web the
 * redirect is the page origin (Supabase parses the token on load); on native the
 * link opens in the system browser and hands back to the app via this custom URL
 * scheme (registered in Info.plist / AndroidManifest), which we then complete
 * below by extracting the tokens and setting the session.
 */
const NATIVE_AUTH_REDIRECT = "pokepal://auth-callback";

interface AuthContextValue {
  /** True until the persisted session has been restored on load. */
  ready: boolean;
  /** Whether Supabase credentials are present; false = auth disabled, local-only. */
  configured: boolean;
  user: User | null;
  session: Session | null;
  /** Send a passwordless magic link to `email`. Throws on failure. */
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Restore the persisted session on load, then subscribe to auth changes
  // (sign-in via magic-link URL, token refresh, sign-out).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: auth disabled, nothing to restore
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    // Native only: complete sign-in when the OS reopens the app via the
    // `pokepal://auth-callback#access_token=…&refresh_token=…` deep link. On the
    // web this is handled by `detectSessionInUrl` on page load instead.
    let removeDeepLink: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appUrlOpen", ({ url }) => {
          const hash = url.split("#")[1];
          if (!hash) return;
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            void supabase.auth.setSession({ access_token, refresh_token });
          }
        }).then((listener) => {
          removeDeepLink = () => void listener.remove();
        });
      });
    }

    return () => {
      sub.subscription.unsubscribe();
      removeDeepLink?.();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Sign-in isn't available right now.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Native returns via the custom URL scheme; web parses the token from
        // the app's own origin on load (static-export safe).
        emailRedirectTo: Capacitor.isNativePlatform()
          ? NATIVE_AUTH_REDIRECT
          : typeof window !== "undefined"
            ? window.location.origin
            : undefined,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      user: session?.user ?? null,
      session,
      signInWithEmail,
      signOut,
    }),
    [ready, session, signInWithEmail, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
