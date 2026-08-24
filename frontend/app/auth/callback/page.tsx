"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "../../../lib/AuthContext";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams()!;
  const { loginWithTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const role = params.get("role");
    const userStatus = params.get("status");

    if (!accessToken || !refreshToken || !role) {
      setError("Invalid callback — missing tokens. Please try signing in again.");
      return;
    }

    loginWithTokens({ accessToken, refreshToken, role, status: userStatus ?? "active" });

    if (role === "doctor" && userStatus === "profile_incomplete") {
      router.replace("/doctor/complete-profile");
    } else if (role === "doctor" && userStatus === "pending_approval") {
      router.replace("/doctor/pending");
    } else if (role === "doctor") {
      router.replace("/doctor");
    } else if (role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/patient");
    }
  }, [params, router, loginWithTokens]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f1f6f2] p-6">
        <div className="max-w-md rounded-3xl border border-[#e8c4c4] bg-[#fdf2f2] p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-[#c94f4f]">Sign-In Failed</p>
          <p className="mt-2 text-sm text-[#587066]">{error}</p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-full bg-[#3e6b63] px-6 py-2 text-sm font-semibold text-white hover:bg-[#345b54]"
          >
            Back to Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
        <p className="text-sm text-[#587066]">Completing sign-in…</p>
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
