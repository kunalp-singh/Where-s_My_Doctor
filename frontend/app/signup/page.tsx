"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../lib/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const specialisations = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Neurology",
  "Orthopedics",
  "Psychiatry",
];

export default function SignUpPage() {
  const [role, setRole] = useState<"patient" | "doctor" | "admin">("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialisation, setSpecialisation] = useState(specialisations[0]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const newUser = await register({
        name,
        email,
        password,
        role,
        specialisation: role === "doctor" ? specialisation : undefined,
      });

      if (newUser.role === "doctor" || newUser.status === "pending_approval") {
        router.push("/doctor/pending");
      } else if (newUser.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/patient");
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("fetch") || err.message?.toLowerCase().includes("network")) {
        setError("Network error — make sure the backend server is running.");
      } else {
        setError(err.message || "Failed to create account. Please check your details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = () => {
    window.location.href = `${API_URL}/auth/google?role=${role}`;
  };

  const roleColors: Record<string, string> = {
    patient: "bg-[#3e6b63] shadow-sm",
    doctor: "bg-[#0f766e] shadow-sm",
    admin: "bg-[#b45309] shadow-sm",
  };

  return (
    <main className="min-h-[calc(100vh-73px)] w-full bg-[#fdfbf7] text-[#21322a] font-sans antialiased overflow-x-hidden selection:bg-[#3e6b63]/20 flex flex-col lg:flex-row">
      {/* ========================================================================= */}
      {/* LEFT PANEL (~55% desktop, top band mobile): Translucent Image & Welcome */}
      {/* ========================================================================= */}
      {/* TODO: replace with final auth background image at /public/images/auth-background.jpg */}
      <section
        className="relative lg:w-[55%] min-h-[320px] lg:min-h-[calc(100vh-73px)] bg-cover bg-center bg-no-repeat flex flex-col justify-between p-8 lg:p-16 overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(253,251,247,0.86) 0%, rgba(237,244,239,0.80) 50%, rgba(248,246,240,0.90) 100%), url('/images/auth-background.jpg'), linear-gradient(135deg, #edf4ef 0%, #dff0e5 100%)",
        }}
      >
        {/* Floating Organic Accent Blobs */}
        <div
          className="pointer-events-none absolute -top-12 -left-12 h-72 w-72 bg-[#dff0e5]/50 blur-3xl opacity-70"
          style={{ borderRadius: "58% 42% 70% 30% / 45% 45% 55% 55%" }}
        />
        <div
          className="pointer-events-none absolute bottom-10 -right-16 h-80 w-80 bg-[#3e6b63]/10 blur-3xl opacity-60"
          style={{ borderRadius: "35% 65% 60% 40% / 55% 35% 65% 45%" }}
        />

        {/* Top Branding Badge */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#3e6b63]/20 bg-[#edf4ef] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#23663d] shadow-sm hover:bg-[#dff0e5] transition">
            <span className="text-base">🌿</span>
            CareConnect
          </Link>
        </div>

        {/* Overlaid Welcome Hero Statement */}
        <div className="relative z-10 my-auto max-w-lg space-y-4 py-8">
          <h2 className="text-3xl font-black tracking-tight text-[#21322a] sm:text-5xl leading-[1.12]">
            Join CareConnect — <br />
            <span className="text-[#3e6b63]">Your Recovery Begins Here</span>
          </h2>
          <p className="text-sm font-medium leading-relaxed text-[#42564f] max-w-md">
            Create an account to connect with top specialists, log symptoms effortlessly, receive automated care follow-ups, and track your wellness journey.
          </p>

          {/* Organic Pebble Callout Badge */}
          <div
            className="inline-flex items-center gap-3 border border-[#3e6b63]/20 bg-white/80 px-5 py-3 backdrop-blur-md shadow-sm"
            style={{ borderRadius: "40% 60% 35% 65% / 50% 50% 50% 50%" }}
          >
            <span className="text-xl">🌟</span>
            <span className="text-xs font-bold text-[#23663d]">
              Patient, Doctor & Admin Portals
            </span>
          </div>
        </div>

        {/* Subtle Footer Note */}
        <div className="relative z-10 text-[11px] font-semibold text-[#587066]">
          © 2026 CareConnect • Intelligent Health & Recovery Ecosystem
        </div>
      </section>

      {/* ========================================================================= */}
      {/* RIGHT PANEL (~45% desktop, main focus mobile): Organic Form Container */}
      {/* ========================================================================= */}
      <section className="lg:w-[45%] flex items-center justify-center p-6 lg:p-12 bg-[#fdfbf7]">
        <div
          className="w-full max-w-md border border-[#d7e2db] bg-white/95 p-8 backdrop-blur-md shadow-[0_16px_50px_rgba(44,66,58,0.08)] animate-in fade-in slide-in-from-bottom-4 duration-300"
          style={{ borderRadius: "28px 14px 34px 18px" }}
        >
          {/* Top Form Icon & Header */}
          <div className="mb-6 space-y-1.5 text-center">
            <div
              className="mx-auto flex h-12 w-12 items-center justify-center bg-[#edf4ef] text-[#3e6b63] shadow-inner"
              style={{ borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }}
            >
              <span className="text-xl">🌿</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#21322a]">
              Create Your Account
            </h1>
            <p className="text-xs font-medium text-[#587066]">
              Select your role and enter your details to register
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#e8c4c4] bg-[#fdf2f2] p-3.5 text-xs font-medium text-[#c94f4f] animate-in fade-in">
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Select Account Role
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-full border border-[#d7e2db] bg-[#f9f7f1]/50 p-1">
                {(["patient", "doctor", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-full py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      role === r ? `${roleColors[r]} text-white scale-105` : "text-[#587066] hover:text-[#21322a]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Full Name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "doctor" ? "Dr. Evelyn Vance" : role === "admin" ? "Admin Name" : "Jane Doe"}
                className="mt-1.5 w-full rounded-full border border-[#d7e2db] bg-[#f9f7f1]/50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:bg-white focus:ring-2 focus:ring-[#3e6b63]/20"
              />
            </div>

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
                className="mt-1.5 w-full rounded-full border border-[#d7e2db] bg-[#f9f7f1]/50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:bg-white focus:ring-2 focus:ring-[#3e6b63]/20"
              />
            </div>

            {role === "doctor" && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                  Specialisation
                </label>
                <select
                  value={specialisation}
                  onChange={(e) => setSpecialisation(e.target.value)}
                  className="mt-1.5 w-full rounded-full border border-[#d7e2db] bg-[#f9f7f1]/50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:bg-white focus:ring-2 focus:ring-[#3e6b63]/20"
                >
                  {specialisations.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Password <span className="font-normal text-[#587066]">(min. 8 chars)</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-full border border-[#d7e2db] bg-[#f9f7f1]/50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:bg-white focus:ring-2 focus:ring-[#3e6b63]/20"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              variant="accent"
              size="lg"
              className="mt-3 w-full justify-center rounded-full py-3.5 shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              {isSubmitting ? "Creating Account…" : `Sign Up as ${role.charAt(0).toUpperCase() + role.slice(1)} →`}
            </Button>

            {role === "doctor" && (
              <p className="mt-1 text-center text-[11px] text-[#587066]">
                Doctor accounts require admin approval before accepting consultations.
              </p>
            )}
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#d7e2db]/70" />
            <span className="text-[10px] font-bold tracking-wider text-[#76857c] uppercase">
              OR
            </span>
            <div className="h-px flex-1 bg-[#d7e2db]/70" />
          </div>

          {/* Google Sign-Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-[#d7e2db] bg-white py-3 text-sm font-bold text-[#21322a] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#edf4ef] hover:border-[#3e6b63]"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          {/* Footer Navigation Link */}
          <p className="mt-6 text-center text-xs text-[#587066] font-medium">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#3e6b63] hover:underline">
              Log In
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
