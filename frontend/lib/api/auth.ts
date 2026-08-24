import { apiFetch, setMemoryTokens } from "./client";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: "patient" | "doctor" | "admin";
  status: "active" | "pending_approval" | "rejected" | "profile_incomplete";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
}

export async function loginUser(email: string, password: string): Promise<TokenPair> {
  const data = await apiFetch<TokenPair>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setMemoryTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
  role: "patient" | "doctor" | "admin";
  specialisation?: string;
}): Promise<TokenPair> {
  const data = await apiFetch<TokenPair>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setMemoryTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function getCurrentUser(): Promise<PublicUser> {
  return apiFetch<PublicUser>("/auth/me");
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const data = await apiFetch<TokenPair>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  setMemoryTokens(data.accessToken, data.refreshToken);
  return data;
}
