import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, signInWithToken, signOut as apiSignOut } from "../lib/api";

interface AuthContextType {
  ready: boolean; // the initial /api/me probe has resolved
  email: string | null; // logged-in owner email, or null when anonymous
  signIn: (token: string) => Promise<boolean>; // verify + persist an owner token
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    // Probe current auth: sends the stored owner token and/or Access cookie.
    api.me().then((r) => {
      if (!alive) return;
      setEmail(r?.email ?? null);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const signIn = async (token: string): Promise<boolean> => {
    const e = await signInWithToken(token);
    if (e) setEmail(e);
    return !!e;
  };

  const signOut = () => {
    apiSignOut();
    setEmail(null);
  };

  return (
    <AuthContext.Provider value={{ ready, email, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
