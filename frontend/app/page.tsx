"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../lib/AuthContext";

export default function RootPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === "authenticated" && user) {
      if (user.role === "patient") {
        router.push("/patient");
      } else if (user.role === "doctor") {
        if (user.status === "pending_approval") {
          router.push("/doctor/pending");
        } else {
          router.push("/doctor");
        }
      } else if (user.role === "admin") {
        router.push("/admin");
      }
    }
  }, [user, authStatus, router]);

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-[#21322a] font-sans antialiased overflow-x-hidden selection:bg-[#3e6b63]/20">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION (Full-bleed translucent background image + organic blobs) */}
      {/* ========================================================================= */}
      {/* Full-bleed translucent hero background image */}
      <section
        className="relative min-h-[85vh] w-full bg-cover bg-center bg-no-repeat flex flex-col justify-between pt-12 pb-16 px-6"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(253,251,247,0.82) 0%, rgba(237,244,239,0.78) 50%, rgba(248,246,240,0.85) 100%), url('/images/hero-background.jpg')",
        }}
      >
        {/* Floating Organic Background Accents (Peanut / Blob SVG shapes) */}
        <div
          className="pointer-events-none absolute -top-12 -left-16 h-80 w-80 bg-[#dff0e5]/40 blur-3xl opacity-70"
          style={{ borderRadius: "58% 42% 70% 30% / 45% 45% 55% 55%" }}
        />
        <div
          className="pointer-events-none absolute top-1/3 -right-20 h-96 w-96 bg-[#3e6b63]/10 blur-3xl opacity-60"
          style={{ borderRadius: "35% 65% 60% 40% / 55% 35% 65% 45%" }}
        />

        <div className="relative z-10 mx-auto max-w-5xl w-full my-auto py-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Heading & Value Prop */}
            <div className="space-y-6 lg:col-span-7 animate-in fade-in duration-500">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#3e6b63]/20 bg-[#edf4ef] px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#23663d] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#23663d] animate-pulse" />
                Care & Recovery Ecosystem
              </div>

              <h1 className="text-4xl font-black tracking-tight text-[#21322a] sm:text-6xl lg:text-7xl leading-[1.08]">
                Healthcare Designed Around{" "}
                <span className="relative inline-block text-[#3e6b63]">
                  Your Recovery
                  {/* Subtle organic underline splash */}
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-[#3e6b63]/30"
                    viewBox="0 0 200 12"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8C50 2 150 12 198 4"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-[#42564f] sm:text-lg font-medium">
                Intelligent healthcare management bringing patients, doctors, and care plans together with AI-driven pre-visit triage, seamless scheduling, and automated recovery steps.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link href="/login">
                  <Button variant="accent" size="lg" className="rounded-full px-8 py-3.5 shadow-lg hover:scale-105 transition-all">
                    Log In to Portal
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="secondary" size="lg" className="rounded-full px-8 py-3.5 border-2 border-[#3e6b63]/20 hover:border-[#3e6b63]">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column: Floating Organic Accent Card (Asymmetric Pebble Shape) */}
            <div className="relative lg:col-span-5 flex justify-center">
              <div
                className="relative w-full max-w-sm border border-[#3e6b63]/20 bg-white/90 p-8 backdrop-blur-md shadow-[0_20px_50px_rgba(44,66,58,0.12)] transition-transform duration-300 hover:scale-[1.02]"
                style={{ borderRadius: "45% 55% 62% 38% / 40% 50% 50% 60%" }}
              >
                <div className="space-y-4 text-center">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center bg-[#edf4ef] text-[#3e6b63] shadow-inner"
                    style={{ borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" }}
                  >
                    <span className="text-3xl">🌿</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#21322a]">
                    Patient-Centered Care
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-[#587066]">
                    Experience effortless symptom logging, instant specialist matching, and continuous post-visit guidance.
                  </p>
                  <div className="pt-2">
                    <span className="inline-block rounded-full bg-[#dff0e5] px-4 py-1 text-[11px] font-bold text-[#23663d]">
                      ✓ 100% Doctor Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Curved Wave Section Divider (Hero -> How it Works) */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none">
          <svg
            className="relative block w-full h-12 text-[#fdfbf7]"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            fill="currentColor"
          >
            <path d="M0,0 C150,90 350,-40 500,60 C650,140 900,10 1200,40 L1200,120 L0,120 Z" />
          </svg>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. HOW IT WORKS (Organic Flowing Connected Nodes: Patient -> Care -> Recovery) */}
      {/* ========================================================================= */}
      <section className="relative py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center space-y-3 mb-16">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
            Simple 3-Step Journey
          </span>
          <h2 className="text-3xl font-black text-[#21322a] sm:text-4xl">
            How CareConnect Works
          </h2>
          <p className="text-xs sm:text-sm text-[#587066] max-w-md mx-auto">
            From initial symptom input to full post-consultation recovery, your care path is continuous.
          </p>
        </div>

        {/* Organic Flowing Step Nodes */}
        <div className="relative grid gap-10 md:grid-cols-3 items-stretch">
          {/* Step 1 Node */}
          <div
            className="relative flex flex-col items-center text-center p-8 bg-white border border-[#d7e2db] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            style={{ borderRadius: "55% 45% 70% 30% / 40% 60% 40% 60%" }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#3e6b63] text-white text-xs font-black shadow">
              1
            </span>
            <div className="text-4xl mb-4">🗣️</div>
            <h3 className="text-lg font-bold text-[#21322a] mb-2">1. Share Symptoms</h3>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              Speak or type your symptoms. AI transcribes your words verbatim and generates a pre-visit clinical summary.
            </p>
          </div>

          {/* Step 2 Node */}
          <div
            className="relative flex flex-col items-center text-center p-8 bg-[#edf4ef]/70 border border-[#bce2cb] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            style={{ borderRadius: "35% 65% 45% 55% / 60% 40% 60% 40%" }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#3e6b63] text-white text-xs font-black shadow">
              2
            </span>
            <div className="text-4xl mb-4">🩺</div>
            <h3 className="text-lg font-bold text-[#21322a] mb-2">2. Get Matched</h3>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              AI analyzes symptom urgency and pairs you with certified specialists in your required field.
            </p>
          </div>

          {/* Step 3 Node */}
          <div
            className="relative flex flex-col items-center text-center p-8 bg-white border border-[#d7e2db] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1"
            style={{ borderRadius: "65% 35% 50% 50% / 45% 55% 45% 55%" }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[#3e6b63] text-white text-xs font-black shadow">
              3
            </span>
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-bold text-[#21322a] mb-2">3. Book & Recover</h3>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              Choose your time slot, receive calendar invites, and get automated medication & recovery reminders.
            </p>
          </div>
        </div>
      </section>

      {/* Curved Wave Section Divider (How it Works -> Features) */}
      <div className="w-full overflow-hidden leading-none bg-[#edf4ef]/50 py-2">
        <svg
          className="block w-full h-10 text-[#fdfbf7]"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          fill="currentColor"
        >
          <path d="M0,60 C300,120 600,0 900,90 C1050,135 1150,45 1200,60 L1200,0 L0,0 Z" />
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* 3. TRUST & FEATURE HIGHLIGHTS (Asymmetric Organic Blobs of Varying Sizes) */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
            Intelligent Features
          </span>
          <h2 className="text-3xl font-black text-[#21322a] sm:text-4xl">
            Designed for Trust & Efficiency
          </h2>
        </div>

        {/* Asymmetric Organic Grid of Varied Pebble Containers */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 items-center">
          {/* Highlight 1: AI Triage */}
          <div
            className="p-8 bg-[#edf4ef] border border-[#3e6b63]/20 shadow-sm transition-all duration-300 hover:scale-105"
            style={{ borderRadius: "50% 50% 70% 30% / 30% 60% 40% 70%" }}
          >
            <div className="text-3xl mb-3">🤖</div>
            <h4 className="text-base font-extrabold text-[#21322a] mb-1">AI-Assisted Triage</h4>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              Gemini 2.5 Flash transcribes symptoms and prepares pre-visit summaries for doctors before you arrive.
            </p>
          </div>

          {/* Highlight 2: Calendar Sync */}
          <div
            className="p-8 bg-[#f8f6f0] border border-[#d7e2db] shadow-sm transition-all duration-300 hover:scale-105"
            style={{ borderRadius: "35% 65% 55% 45% / 60% 40% 60% 40%" }}
          >
            <div className="text-3xl mb-3">📆</div>
            <h4 className="text-base font-extrabold text-[#21322a] mb-1">Google Calendar Sync</h4>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              Automatic 2-way calendar sync ensures appointment holds and doctor schedules are updated instantly.
            </p>
          </div>

          {/* Highlight 3: Medication Reminders */}
          <div
            className="p-8 bg-white border border-[#d7e2db] shadow-sm transition-all duration-300 hover:scale-105"
            style={{ borderRadius: "60% 40% 40% 60% / 50% 50% 50% 50%" }}
          >
            <div className="text-3xl mb-3">💊</div>
            <h4 className="text-base font-extrabold text-[#21322a] mb-1">Medication Reminders</h4>
            <p className="text-xs text-[#587066] font-medium leading-relaxed">
              Timely SMS and email notifications keep your prescription schedules on track throughout recovery.
            </p>
          </div>

          {/* Highlight 4: Verified Doctors */}
          <div
            className="p-8 bg-[#dff0e5]/80 border border-[#bce2cb] shadow-sm transition-all duration-300 hover:scale-105"
            style={{ borderRadius: "40% 60% 30% 70% / 55% 45% 55% 45%" }}
          >
            <div className="text-3xl mb-3">🛡️</div>
            <h4 className="text-base font-extrabold text-[#23663d] mb-1">Doctor-Verified</h4>
            <p className="text-xs text-[#21322a] font-medium leading-relaxed">
              All medical specialists on CareConnect undergo thorough admin approval before accepting consultations.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. FOOTER (Calm Sage & Warm-White, Wave Top Divider) */}
      {/* ========================================================================= */}
      <footer className="relative bg-[#edf4ef]/60 pt-16 pb-12 px-6 border-t border-[#d7e2db]">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1">
            <span className="text-base font-black text-[#21322a] tracking-tight">
              CareConnect
            </span>
            <p className="text-xs text-[#587066] font-medium">
              Intelligent Healthcare & Recovery Ecosystem • Powered by Gemini AI
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-bold text-[#3e6b63]">
            <Link href="/login" className="hover:underline">Login</Link>
            <Link href="/signup" className="hover:underline">Sign Up</Link>
            <span className="text-[#587066]">© 2026 CareConnect</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
