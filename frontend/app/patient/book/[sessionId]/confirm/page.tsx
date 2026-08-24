"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AIInsightCard } from "../../../../../components/ui/AIInsightCard";
import { Badge } from "../../../../../components/ui/Badge";
import { Button } from "../../../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../../components/ui/Card";
import { StepTracker } from "../../../../../components/ui/StepTracker";
import {
  BookingSession,
  DoctorSearchResult,
  getBookingSession,
  searchDoctors,
  sessionConfirmAppointment,
} from "../../../../../lib/api/patients";
import { useAuth } from "../../../../../lib/AuthContext";

export default function BookingConfirmPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<BookingSession | null>(null);
  const [doctor, setDoctor] = useState<DoctorSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      } else {
        loadSessionDetails();
      }
    }
  }, [authStatus, user, router, sessionId]);

  const loadSessionDetails = async () => {
    setLoading(true);
    try {
      const sess = await getBookingSession(sessionId);
      setSession(sess);

      if (sess.doctorId) {
        const docs = await searchDoctors();
        const found = docs.find((d) => d.id === sess.doctorId);
        if (found) setDoctor(found);
      }
    } catch (err: any) {
      console.error("Error loading session for confirmation", err);
      setErrorMsg("Failed to load appointment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalConfirm = async () => {
    setIsConfirming(true);
    setErrorMsg(null);

    try {
      const result = await sessionConfirmAppointment(sessionId);
      setIsConfirmed(true);
      setTimeout(() => {
        router.push(`/patient/appointments/${result.id}`);
      }, 2000);
    } catch (err: any) {
      console.error("Error confirming booking", err);
      setErrorMsg(err.message || "Failed to confirm booking. Please try again.");
      setIsConfirming(false);
    }
  };

  const steps = [
    { label: "1. Symptoms", completed: true },
    { label: "2. Choose Specialist", completed: true },
    { label: "3. Choose Time Slot", completed: true },
    { label: "4. Confirm", active: true, completed: isConfirmed },
  ];

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Loading Appointment Review...
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
              Step 4 of 4
            </span>
            <h1 className="text-3xl font-black text-[#21322a]">
              Review & Finalize Appointment
            </h1>
          </div>

          <StepTracker steps={steps} />
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {isConfirmed ? (
          <Card className="rounded-3xl border border-[#bce2cb] bg-gradient-to-br from-[#dff0e5] to-[#f4f8f5] p-10 text-center shadow-lg animate-in zoom-in-95">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#3e6b63] text-white text-2xl shadow-md">
              ✓
            </div>
            <h2 className="mt-4 text-2xl font-black text-[#21322a]">
              Appointment Confirmed! 🌸
            </h2>
            <p className="mt-2 text-xs text-[#2e5e54] max-w-md mx-auto">
              Your appointment with Dr. {doctor?.name || "your specialist"} has been confirmed. Confirmation notices and calendar invites have been issued.
            </p>
            <p className="mt-4 text-[11px] font-semibold text-[#587066]">
              Redirecting to your care portal...
            </p>
          </Card>
        ) : (
          <>
            {/* AI Summary Review */}
            {session?.aiSummary && (
              <AIInsightCard
                title="AI Symptom Triage Record"
                summary={`Chief Complaint: ${session.aiSummary.chiefComplaint || session.symptomsText}`}
                insights={
                  session.aiSummary.followUpQuestions || [
                    "What triggers or relieves these symptoms?",
                  ]
                }
                tone={
                  ["high", "urgent", "critical"].includes((session.aiSummary.urgency || "").toLowerCase())
                    ? "urgent"
                    : (session.aiSummary.urgency || "").toLowerCase() === "medium"
                    ? "warning"
                    : "calm"
                }
                badgeLabel={`${(session.aiSummary.urgency || "routine").toUpperCase()} URGENCY`}
              />
            )}

            {/* Doctor & Slot Details */}
            <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
              <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
                <CardTitle className="text-lg font-bold">Appointment Summary</CardTitle>
              </CardHeader>
              <CardBody className="px-0 pt-4 pb-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#d7e2db] bg-white p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63]">
                      Assigned Specialist
                    </span>
                    <h3 className="font-bold text-[#21322a] text-base mt-1">
                      {doctor?.name || "Specialist Doctor"}
                    </h3>
                    <p className="text-xs text-[#587066]">
                      {doctor?.specialisation || session?.recommendedSpecialisation}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#d7e2db] bg-white p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63]">
                      Held Slot Window
                    </span>
                    <p className="font-bold text-[#21322a] text-sm mt-1">
                      15-minute Hold Reserved
                    </p>
                    <p className="text-xs text-[#587066]">
                      Slot status: Reserved for confirmation
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#d7e2db]/70 flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/patient/book/${sessionId}/doctors`}>
                    <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold text-[#587066]">
                      ← Change Specialist
                    </Button>
                  </Link>

                  <Button
                    onClick={handleFinalConfirm}
                    disabled={isConfirming}
                    variant="accent"
                    size="lg"
                    className="rounded-full shadow-lg"
                  >
                    {isConfirming ? "Confirming Booking..." : "Confirm & Finalize Booking 🌸"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

