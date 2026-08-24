"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, loginUser, PublicUser, refreshTokens, registerUser } from "./api/auth";
import { getMemoryRefreshToken, setMemoryTokens } from "./api/client";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface LoginWithTokensPayload {
  accessToken: string;
  refreshToken: string;
  role: string;
  status: string;
}

interface AuthContextType {
  user: PublicUser | null;
  authStatus: AuthStatus;
  login: (email: string, password: string) => Promise<PublicUser>;
  loginWithTokens: (payload: LoginWithTokensPayload) => void;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: "patient" | "doctor" | "admin";
    specialisation?: string;
  }) => Promise<PublicUser>;
  logout: () => void;
  refreshSession: () => Promise<PublicUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");

  const refreshSession = async (): Promise<PublicUser | null> => {
    try {
      const storedRefreshToken = getMemoryRefreshToken();
      if (storedRefreshToken) {
        await refreshTokens(storedRefreshToken);
      }
      const userData = await getCurrentUser();
      setUser(userData);
      setAuthStatus("authenticated");
      return userData;
    } catch (err) {
      setUser(null);
      setAuthStatus("unauthenticated");
      setMemoryTokens(null, null);
      return null;
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (email: string, password: string): Promise<PublicUser> => {
    await loginUser(email, password);
    const userData = await getCurrentUser();
    setUser(userData);
    setAuthStatus("authenticated");
    return userData;
  };

  /**
   * Called by the /auth/callback page after Google OAuth completes.
   * Stores tokens in memory and fetches the full user profile.
   */
  const loginWithTokens = ({ accessToken, refreshToken }: LoginWithTokensPayload) => {
    setMemoryTokens(accessToken, refreshToken);
    // Kick off a session fetch — when it resolves, user state updates automatically
    getCurrentUser()
      .then((userData) => {
        setUser(userData);
        setAuthStatus("authenticated");
      })
      .catch(() => {
        setUser(null);
        setAuthStatus("unauthenticated");
      });
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    role: "patient" | "doctor" | "admin";
    specialisation?: string;
  }): Promise<PublicUser> => {
    await registerUser(payload);
    const userData = await getCurrentUser();
    setUser(userData);
    setAuthStatus("authenticated");
    return userData;
  };

  const logout = () => {
    setMemoryTokens(null, null);
    setUser(null);
    setAuthStatus("unauthenticated");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authStatus,
        login,
        loginWithTokens,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
