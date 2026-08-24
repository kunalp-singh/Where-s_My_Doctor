"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../components/ui/Card";
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
    <main className="relative min-h-[calc(100vh-73px)] overflow-hidden bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-16 text-[#21322a]">
      {/* Background Botanical Line-Art Asset Layer (Low opacity 6%) */}
      <div className="pointer-events-none absolute -left-20 -top-20 z-0 h-96 w-96 opacity-[0.06] select-none">
        <svg viewBox="0 0 200 200" fill="none" stroke="#21322a" strokeWidth="2">
          <path d="M100 20C100 20 60 70 60 120C60 170 100 180 100 180C100 180 140 170 140 120C140 70 100 20 100 20Z" />
          <path d="M100 20V180" />
          <path d="M100 60C120 70 130 90 130 90" />
          <path d="M100 90C80 100 70 120 70 120" />
          <path d="M100 120C120 130 130 150 130 150" />
        </svg>
      </div>
      <div className="pointer-events-none absolute -right-20 bottom-10 z-0 h-96 w-96 opacity-[0.06] select-none">
        <svg viewBox="0 0 200 200" fill="none" stroke="#21322a" strokeWidth="2">
          <path d="M100 20C100 20 60 70 60 120C60 170 100 180 100 180C100 180 140 170 140 120C140 70 100 20 100 20Z" />
          <path d="M100 20V180" />
          <path d="M100 70C80 80 70 100 70 100" />
          <path d="M100 110C120 120 130 140 130 140" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl space-y-12">
        <header className="space-y-6 text-center animate-in fade-in duration-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#bce2cb] bg-[#dff0e5] px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#23663d] shadow-sm">
            <svg className="h-3.5 w-3.5 text-[#23663d]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            Care & Recovery Ecosystem
          </div>
          
          <h1 className="text-4xl font-black tracking-tight text-[#21322a] sm:text-6xl">
            Appointment Care
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[#42564f] sm:text-lg">
            Intelligent healthcare management bringing patients, doctors, and care plans together with AI-driven pre-visit triage and automated follow-ups.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link href="/login">
              <Button variant="accent" size="lg" className="rounded-full shadow-md">
                Log In to Portal
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="secondary" size="lg" className="rounded-full">
                Create Account
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-6 sm:grid-cols-3">
          <Card hoverable className="p-6 transition-all duration-200">
            <CardHeader className="px-0 pt-0 pb-3 border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ef] text-[#3e6b63]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <CardTitle className="text-xl font-bold">Patients</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <p className="text-xs leading-relaxed text-[#587066]">
                Discover specialists, pick convenient time slots, describe symptoms for AI triage summaries, and track care plans seamlessly.
              </p>
            </CardBody>
          </Card>

          <Card hoverable className="p-6 transition-all duration-200">
            <CardHeader className="px-0 pt-0 pb-3 border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d9ece8] text-[#0f766e]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <CardTitle className="text-xl font-bold">Doctors</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <p className="text-xs leading-relaxed text-[#587066]">
                Review pre-visit AI insights, manage daily queues, log visit details, prescribe medications, and coordinate schedules.
              </p>
            </CardBody>
          </Card>

          <Card hoverable className="p-6 transition-all duration-200">
            <CardHeader className="px-0 pt-0 pb-3 border-b-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f7edd0] text-[#b45309]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <CardTitle className="text-xl font-bold">Admins</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <p className="text-xs leading-relaxed text-[#587066]">
                Review doctor credentials, approve pending accounts, manage shift schedules, resolve leave conflicts, and monitor metrics.
              </p>
            </CardBody>
          </Card>
        </section>
      </div>
    </main>
  );
}
