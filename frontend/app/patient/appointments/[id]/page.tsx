"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AIInsightCard } from "../../../../components/ui/AIInsightCard";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../components/ui/Card";
import { cancelPatientAppointment, listPatientAppointments, PatientAppointmentResponse } from "../../../../lib/api/patients";
import { useAuth } from "../../../../lib/AuthContext";

export default function PatientAppointmentDetailPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;

  const [appointment, setAppointment] = useState<PatientAppointmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      } else {
        loadDetail();
      }
    }
  }, [authStatus, user, router]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const list = await listPatientAppointments();
      const match = list.find((a) => a.id === appointmentId);
      if (match) {
        setAppointment(match);
      }
    } catch (err) {
      console.error("Error loading appointment detail", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!confirm("Are you sure you want to cancel and delete this appointment?")) {
      return;
    }
    setIsDeleting(true);
    try {
      await cancelPatientAppointment(appointmentId);
      router.push("/patient");
    } catch (err: any) {
      console.error("Failed to cancel appointment", err);
      alert(err.message || "Could not cancel appointment.");
      setIsDeleting(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return <div className="p-12 text-center text-[#587066]">Loading Appointment Details...</div>;
  }

  if (!appointment) {
    return (
      <main className="min-h-screen bg-[#f1f6f2] p-12 text-center text-[#21322a]">
        <h1 className="text-2xl font-bold">Appointment Not Found</h1>
        <p className="mt-2 text-sm text-[#587066]">The requested appointment record could not be found.</p>
        <div className="mt-4">
          <Link href="/patient">
            <Button variant="secondary">Back to Dashboard</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/patient" className="text-xs font-semibold uppercase tracking-widest text-[#3e6b63] hover:underline">
              ← Back to Patient Portal
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-[#21322a]">
              Appointment #{appointment.id.slice(-6)}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={appointment.status === "booked" ? "calm" : appointment.status === "completed" ? "neutral" : "urgent"}>
              {appointment.status.toUpperCase()}
            </Badge>

            {appointment.status !== "cancelled" && (
              <button
                type="button"
                onClick={handleDeleteAppointment}
                disabled={isDeleting}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 transition shadow-sm"
              >
                {isDeleting ? "Deleting..." : "Cancel Appointment"}
              </button>
            )}
          </div>
        </header>

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]">
            <CardTitle className="text-lg font-bold">Appointment Info</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-4 pb-0 space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#587066]">
                  Date & Time
                </span>
                <p className="mt-1 text-sm font-medium text-[#21322a]">
                  {new Date(appointment.slotStart).toLocaleString([], {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#587066]">
                  Status
                </span>
                <p className="mt-1 text-sm font-medium text-[#21322a] capitalize">
                  {appointment.status}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {appointment.symptomSummary && (
          <AIInsightCard
            title="Pre-Visit AI Triage Summary"
            summary={`Chief Complaint: ${appointment.symptomSummary.chiefComplaint}`}
            insights={[
              `Urgency Level: ${appointment.symptomSummary.urgency.toUpperCase()}`,
              ...(appointment.symptomSummary.followUpQuestions || []).map(
                (q) => `Doctor Follow-up: ${q}`
              ),
            ]}
            tone={appointment.symptomSummary.urgency === "urgent" ? "urgent" : "calm"}
          />
        )}

        {appointment.aiPostVisitSummary && (
          <AIInsightCard
            title="Post-Visit Patient Care Summary (AI Generated)"
            summary={appointment.aiPostVisitSummary.summary}
            insights={[
              ...((appointment.aiPostVisitSummary.followUpSteps || appointment.aiPostVisitSummary.follow_up_steps || []).map(
                (step) => `Follow-up Step: ${step}`
              )),
              ...((appointment.aiPostVisitSummary.redFlags || appointment.aiPostVisitSummary.red_flags || []).map(
                (flag) => `Warning Sign: ${flag}`
              )),
            ]}
            tone="calm"
          />
        )}

        {appointment.visitNotes && (
          <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm space-y-4">
            <CardHeader className="px-0 pt-0 pb-3 border-b border-[#d7e2db]">
              <CardTitle className="text-lg font-bold">Post-Visit Notes & Medication Checklist</CardTitle>
            </CardHeader>
            <CardBody className="px-0 pt-2 pb-0 space-y-4">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#587066]">
                  Diagnosis
                </span>
                <p className="mt-1 text-sm font-medium text-[#21322a]">
                  {appointment.visitNotes.diagnosis || "No formal diagnosis logged."}
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[#587066]">
                  Clinical Notes
                </span>
                <p className="mt-1 text-sm text-[#42564f]">
                  {appointment.visitNotes.notes || "No additional notes."}
                </p>
              </div>

              {(appointment.visitNotes.prescriptions || []).length > 0 && (
                <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#21322a]">
                    Prescribed Medication Checklist
                  </h4>
                  <div className="space-y-2">
                    {appointment.visitNotes.prescriptions!.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-3 border-b border-[#f1f6f2] pb-2 text-xs">
                        <input type="checkbox" className="h-4 w-4 accent-[#3e6b63]" />
                        <div className="flex-1">
                          <span className="font-semibold text-[#21322a]">{p.medicationName}</span>
                          <span className="ml-2 text-[#587066]">({p.dosage} — {p.frequency})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </main>
  );
}
