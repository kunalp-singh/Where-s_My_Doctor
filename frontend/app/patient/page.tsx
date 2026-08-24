"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AIInsightCard } from "../../components/ui/AIInsightCard";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cancelPatientAppointment, listPatientAppointments, PatientAppointmentResponse } from "../../lib/api/patients";
import { useAuth } from "../../lib/AuthContext";

export default function PatientDashboardPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<PatientAppointmentResponse[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      } else {
        loadAppointments();
      }
    }
  }, [authStatus, user, router]);

  const loadAppointments = async () => {
    try {
      const data = await listPatientAppointments();
      setAppointments(data);
    } catch (err) {
      console.error("Error loading appointments", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel and delete this appointment?")) {
      return;
    }
    setCancellingId(appointmentId);
    try {
      await cancelPatientAppointment(appointmentId);
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId && a.appointmentId !== appointmentId));
    } catch (err: any) {
      console.error("Failed to cancel appointment", err);
      alert(err.message || "Could not cancel appointment.");
    } finally {
      setCancellingId(null);
    }
  };

  if (authStatus === "loading" || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Loading Patient Care Portal...
          </p>
        </div>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(
    (a) => a.status === "booked" || a.status === "held"
  );
  const completedAppointments = appointments.filter((a) => a.status === "completed");

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      {/* Background Botanical Overlay */}
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 opacity-[0.04] select-none">
        <svg viewBox="0 0 200 200" fill="none" stroke="#21322a" strokeWidth="2">
          <path d="M100 20C100 20 60 70 60 120C60 170 100 180 100 180C100 180 140 170 140 120C140 70 100 20 100 20Z" />
          <path d="M100 20V180" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl space-y-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-[#d7e2db]/70 bg-[#f9f7f1]/80 p-8 backdrop-blur-md shadow-[0_8px_30px_rgba(44,66,58,0.06)] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dff0e5] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#23663d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#23663d]" />
              Patient Care Portal
            </span>
            <h1 className="text-3xl font-black tracking-tight text-[#21322a]">
              Welcome back, {user?.name}
            </h1>
            <p className="text-xs text-[#587066]">
              Manage your upcoming visits, describe symptoms for AI triage, and track care plans.
            </p>
          </div>
          <Link href="/patient/book">
            <Button variant="accent" size="lg" className="rounded-full shadow-lg hover:scale-105">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Book New Appointment
            </Button>
          </Link>
        </header>

        {/* Upcoming Appointments Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-[#21322a]">Upcoming Appointments</h2>
            <span className="text-xs font-semibold text-[#587066]">
              {upcomingAppointments.length} scheduled
            </span>
          </div>

          {upcomingAppointments.length === 0 ? (
            <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-10 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#edf4ef] text-[#3e6b63]">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 22V12" />
                  <path d="M12 12C12 7 16 5 20 6C20 10 17 12 12 12Z" />
                  <path d="M12 15C12 11 8 9 4 10C4 14 7 15 12 15Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-[#21322a]">No Upcoming Appointments</h3>
              <p className="mt-1 text-xs text-[#587066] max-w-sm mx-auto">
                Take a proactive step towards your wellbeing. Pick a doctor and select a convenient time slot today.
              </p>
              <div className="mt-6">
                <Link href="/patient/book">
                  <Button variant="primary" size="md" className="rounded-full">
                    Find a Doctor & Book
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {upcomingAppointments.map((apt) => (
                <Card key={apt.id} hoverable className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63]">
                        {apt.doctorName ? `Dr. ${apt.doctorName}` : "Doctor Visit"}
                      </span>
                      <h3 className="mt-1 text-base font-bold text-[#21322a]">
                        {new Date(apt.slotStart).toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </h3>
                      <p className="text-xs font-medium text-[#587066]">
                        {new Date(apt.slotStart).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(apt.slotEnd).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={apt.status === "booked" ? "calm" : "neutral"}>
                        {apt.status.toUpperCase()}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleCancelAppointment(apt.id)}
                        disabled={cancellingId === apt.id}
                        className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-100 transition"
                      >
                        {cancellingId === apt.id ? "Deleting..." : "Delete Visit"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-[#d7e2db]/70 pt-4 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-[#76857c]">Ref: #{apt.id.slice(-6)}</span>
                    <Link href={`/patient/appointments/${apt.id}`}>
                      <span className="text-xs font-bold text-[#3e6b63] hover:underline flex items-center gap-1">
                        View Details →
                      </span>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Recent Visit Summaries Section */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl font-bold tracking-tight text-[#21322a]">Recent Visit Summaries</h2>
          {completedAppointments.length === 0 ? (
            <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 text-center text-xs text-[#587066]">
              No completed visits or AI summaries logged yet.
            </Card>
          ) : (
            <div className="space-y-4">
              {completedAppointments.map((apt) => (
                <AIInsightCard
                  key={apt.id}
                  title={`Visit Summary — ${new Date(apt.slotStart).toLocaleDateString()}`}
                  summary={apt.visitNotes?.diagnosis || "Routine Consultation"}
                  insights={[
                    `Clinical Notes: ${apt.visitNotes?.notes || "No extra notes logged."}`,
                    ...(apt.visitNotes?.prescriptions || []).map(
                      (p) => `Prescription: ${p.medicationName} (${p.dosage}, ${p.frequency})`
                    ),
                  ]}
                  tone="calm"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
