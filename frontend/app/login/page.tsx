"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { useAuth } from "../../lib/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const loggedUser = await login(email, password);

      if (loggedUser.role === "patient") {
        router.push("/patient");
      } else if (loggedUser.role === "doctor") {
        router.push(loggedUser.status === "pending_approval" ? "/doctor/pending" : "/doctor");
      } else if (loggedUser.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network")) {
        setError("Network error — make sure the backend server is running on http://127.0.0.1:8000.");
      } else {
        setError(err.message || "Invalid credentials. Please check your email and password.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = `${API_URL}/auth/google?role=patient`;
  };

  return (
    <main className="relative flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] p-6 text-[#21322a]">
      {/* Background Botanical Overlay */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-80 w-80 opacity-[0.05] select-none">
        <svg viewBox="0 0 200 200" fill="none" stroke="#21322a" strokeWidth="2">
          <path d="M100 20C100 20 60 70 60 120C60 170 100 180 100 180C100 180 140 170 140 120C140 70 100 20 100 20Z" />
          <path d="M100 20V180" />
        </svg>
      </div>

      <Card className="relative z-10 w-full max-w-md rounded-3xl border border-[#d7e2db] bg-[#f9f7f1]/90 backdrop-blur-md shadow-[0_16px_50px_rgba(44,66,58,0.1)]">
        <CardHeader className="border-b border-[#d7e2db]/70 px-6 py-5 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ef] text-[#3e6b63]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <CardTitle className="text-2xl font-black text-[#21322a]">Welcome Back</CardTitle>
          <p className="mt-1 text-xs font-medium text-[#587066]">
            Sign in to access your care portal
          </p>
        </CardHeader>

        <CardBody className="px-6 py-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-[#e8c4c4] bg-[#fdf2f2] p-4 text-xs font-medium text-[#c94f4f] animate-in fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              size="lg"
              className="mt-2 w-full justify-center rounded-full py-3.5"
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#d7e2db]" />
            <span className="text-[11px] font-semibold text-[#76857c]">OR</span>
            <div className="h-px flex-1 bg-[#d7e2db]" />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#d7e2db] bg-white py-3 text-sm font-semibold text-[#21322a] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f1f6f2] hover:shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-xs text-[#587066]">
            Don't have an account?{" "}
            <Link href="/signup" className="font-bold text-[#3e6b63] underline hover:text-[#21322a]">
              Sign Up
            </Link>
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
