const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export function setMemoryTokens(accessToken: string | null, refreshToken?: string | null) {
  memoryAccessToken = accessToken;
  if (refreshToken !== undefined) {
    memoryRefreshToken = refreshToken;
    if (typeof window !== "undefined") {
      if (refreshToken) {
        localStorage.setItem("refreshToken", refreshToken);
      } else {
        localStorage.removeItem("refreshToken");
      }
    }
  }
}

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export function getMemoryRefreshToken(): string | null {
  if (memoryRefreshToken) return memoryRefreshToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("refreshToken");
  }
  return null;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: any) => void; reject: (reason?: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const token = getMemoryAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (url.includes("localhost:8000")) {
      url = url.replace("localhost:8000", "127.0.0.1:8000");
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      throw err;
    }
  }

  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (response.status === 401 && !isRetry && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/refresh")) {
    const refreshToken = getMemoryRefreshToken();
    if (refreshToken) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiFetch<T>(endpoint, options, true));
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const tokenData = await refreshRes.json();
          setMemoryTokens(tokenData.accessToken, tokenData.refreshToken);
          processQueue(null, tokenData.accessToken);
          isRefreshing = false;
          return apiFetch<T>(endpoint, options, true);
        } else {
          processQueue(new Error("Refresh token expired"));
          setMemoryTokens(null, null);
          isRefreshing = false;
        }
      } catch (err) {
        processQueue(err);
        setMemoryTokens(null, null);
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const detail = typeof data === "object" && data?.detail ? data.detail : response.statusText;
    throw new ApiError(typeof detail === "string" ? detail : JSON.stringify(detail), response.status, data);
  }

  return data as T;
}
