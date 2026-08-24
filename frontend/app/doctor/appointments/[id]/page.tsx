"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../components/ui/Card";
import { DoctorNotesResponse, getVisitDetail, submitVisitNotes } from "../../../../lib/api/doctors";
import { useAuth } from "../../../../lib/AuthContext";

interface PrescriptionRow {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
}

export default function DoctorConsultationPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;

  const [visitDetail, setVisitDetail] = useState<DoctorNotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Form State
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([
    { medicationName: "", dosage: "", frequency: "Daily", durationDays: 7 },
  ]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else {
        loadVisitData();
      }
    }
  }, [authStatus, user, router, appointmentId]);

  const loadVisitData = async () => {
    try {
      const res = await getVisitDetail(appointmentId);
      setVisitDetail(res);

      if (res.diagnosis) setDiagnosis(res.diagnosis);
      if (res.doctorNotes || res.notes) setNotes(res.doctorNotes || res.notes || "");
      
      const savedPrescriptions = res.prescription || res.prescriptions;
      if (savedPrescriptions && savedPrescriptions.length > 0) {
        setPrescriptions(
          savedPrescriptions.map((p) => ({
            medicationName: p.medicationName,
            dosage: p.dosage,
            frequency: p.frequency,
            durationDays: p.durationDays || 7,
          }))
        );
      }
    } catch (err: any) {
      console.error("Error loading visit detail", err);
      setErrorMsg("Failed to load visit detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptions([...prescriptions, { medicationName: "", dosage: "", frequency: "Daily", durationDays: 7 }]);
  };

  const handlePrescriptionChange = (index: number, field: keyof PrescriptionRow, value: any) => {
    const updated = [...prescriptions];
    (updated[index] as any)[field] = value;
    setPrescriptions(updated);
  };

  const handleRemovePrescriptionRow = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleCompleteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSubmitting(true);

    try {
      const validPrescriptions = prescriptions.filter((p) => p.medicationName.trim().length > 0);
      const chiefComp =
        visitDetail?.aiPreVisitSummary?.chief_complaint ||
        visitDetail?.aiPreVisitSummary?.chiefComplaint ||
        visitDetail?.chiefComplaint ||
        "Routine consultation";

      const res = await submitVisitNotes(appointmentId, {
        chiefComplaint: chiefComp,
        diagnosis,
        notes,
        prescriptions: validPrescriptions,
      });

      setVisitDetail(res);
      setStatusMsg("Visit completed and medical record saved successfully!");
      setTimeout(() => router.push("/doctor"), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to complete visit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Loading Consultation Room...
          </p>
        </div>
      </div>
    );
  }

  const isCompleted = visitDetail?.status === "completed" || Boolean(visitDetail?.doctorNotes);

  const aiSummary = visitDetail?.aiPreVisitSummary;
  const urgency = aiSummary?.urgency || "routine";
  const chiefComplaint = aiSummary?.chief_complaint || aiSummary?.chiefComplaint || visitDetail?.chiefComplaint;
  const followUps = aiSummary?.follow_up_questions || aiSummary?.followUpQuestions || [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/doctor" className="text-xs font-bold uppercase tracking-widest text-[#3e6b63] hover:underline">
              ← Back to Doctor Console
            </Link>
            <h1 className="mt-1 text-3xl font-black text-[#21322a]">
              Consultation: {visitDetail?.patientName || "Patient Visit"}
            </h1>
          </div>
          <Badge variant={isCompleted ? "neutral" : "calm"}>
            {isCompleted ? "🔒 VISIT COMPLETED" : "IN PROGRESS"}
          </Badge>
        </header>

        {statusMsg && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-xs font-bold text-green-800 animate-in fade-in">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Lock Banner if Already Completed */}
        {isCompleted && (
          <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/90 p-4 text-xs font-bold text-blue-900 shadow-sm">
            <span className="text-xl">🔒</span>
            <div>
              <p className="font-extrabold text-sm">Completed Medical Record</p>
              <p className="text-[#3b5998] font-medium mt-0.5">
                This consultation was completed and saved to the patient's permanent medical record. Modifications are locked.
              </p>
            </div>
          </div>
        )}

        {/* AI Pre-Visit Triage & Patient Info Card */}
        <Card className="rounded-3xl border border-[#3e6b63]/30 bg-gradient-to-br from-[#edf4ef] to-[#f8f6f0] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <CardTitle className="text-lg font-bold text-[#21322a]">
                  Patient AI Triage & Symptoms Summary
                </CardTitle>
                <p className="text-xs text-[#587066]">
                  AI-analyzed pre-visit assessment from patient intake
                </p>
              </div>
            </div>
            <Badge variant={urgency === "high" || urgency === "urgent" ? "urgent" : "calm"}>
              {urgency.toUpperCase()} URGENCY
            </Badge>
          </CardHeader>

          <CardBody className="px-0 pt-5 pb-0 space-y-4">
            {/* Raw Spoken/Typed Patient Symptoms */}
            {visitDetail?.symptomsText && (
              <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                  🗣️ Patient's Direct Symptoms Input
                </span>
                <p className="text-xs text-[#21322a] italic font-medium leading-relaxed">
                  "{visitDetail.symptomsText}"
                </p>
              </div>
            )}

            {/* AI Chief Complaint Summary */}
            {chiefComplaint && (
              <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                  📋 AI Summarized Chief Complaint
                </span>
                <p className="text-xs text-[#21322a] font-semibold">
                  {chiefComplaint}
                </p>
              </div>
            )}

            {/* AI Recommended Follow-Up Questions for Doctor */}
            {followUps.length > 0 && (
              <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                  💡 AI Suggested Questions to Ask Patient
                </span>
                <ul className="space-y-1.5 pl-1">
                  {followUps.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[#21322a] font-medium">
                      <span className="text-[#3e6b63] font-bold">•</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Doctor Clinical Notes & Prescription Section */}
        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
            <CardTitle className="text-lg font-bold">
              {isCompleted ? "Saved Clinical Record & Prescriptions" : "Clinical Notes & Prescriptions"}
            </CardTitle>
          </CardHeader>

          <CardBody className="px-0 pt-4 pb-0">
            {isCompleted ? (
              /* Read-Only Summary View for Completed Appointments */
              <div className="space-y-5">
                {diagnosis && (
                  <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                      Diagnosis / Clinical Impression
                    </span>
                    <p className="text-sm font-bold text-[#21322a]">{diagnosis}</p>
                  </div>
                )}

                {notes && (
                  <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                      Doctor Consultation Notes
                    </span>
                    <p className="text-xs text-[#21322a] font-medium whitespace-pre-wrap leading-relaxed">
                      {notes}
                    </p>
                  </div>
                )}

                {prescriptions.filter((p) => p.medicationName).length > 0 && (
                  <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63] block">
                      Prescribed Medications
                    </span>
                    <div className="space-y-2">
                      {prescriptions
                        .filter((p) => p.medicationName)
                        .map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded-xl bg-[#edf4ef] p-3 text-xs font-semibold text-[#21322a]">
                            <div>
                              <span className="font-bold text-sm text-[#3e6b63]">{p.medicationName}</span>
                              <p className="text-[11px] text-[#587066] mt-0.5">
                                Dosage: {p.dosage || "As directed"} • Frequency: {p.frequency}
                              </p>
                            </div>
                            <Badge variant="calm">{p.durationDays || 7} Days</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Editable Form for Pending Consultations */
              <form onSubmit={handleCompleteVisit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                    Diagnosis / Impression
                  </label>
                  <input
                    type="text"
                    required
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Bronchitis, Hypertension Stage 1"
                    className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                    Consultation Notes
                  </label>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record clinical examination observations, treatment advice, and follow-up plan..."
                    className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                  />
                </div>

                <div className="rounded-2xl border border-[#d7e2db]/70 bg-white p-4 space-y-3 shadow-inner">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#21322a]">
                      Prescription Builder
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddPrescriptionRow}
                      className="text-xs font-bold text-[#3e6b63] hover:underline"
                    >
                      + Add Medication
                    </button>
                  </div>

                  {prescriptions.map((p, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-7 items-center">
                      <input
                        type="text"
                        placeholder="Medication Name"
                        value={p.medicationName}
                        onChange={(e) => handlePrescriptionChange(idx, "medicationName", e.target.value)}
                        className="sm:col-span-3 rounded-xl border border-[#d7e2db] bg-[#f9f7f1] p-2.5 text-xs outline-none focus:border-[#3e6b63]"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (500mg)"
                        value={p.dosage}
                        onChange={(e) => handlePrescriptionChange(idx, "dosage", e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-[#d7e2db] bg-[#f9f7f1] p-2.5 text-xs outline-none focus:border-[#3e6b63]"
                      />
                      <input
                        type="text"
                        placeholder="Frequency"
                        value={p.frequency}
                        onChange={(e) => handlePrescriptionChange(idx, "frequency", e.target.value)}
                        className="sm:col-span-1 rounded-xl border border-[#d7e2db] bg-[#f9f7f1] p-2.5 text-xs outline-none focus:border-[#3e6b63]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePrescriptionRow(idx)}
                        className="text-xs font-bold text-red-600 hover:underline sm:col-span-1 text-center"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="accent"
                  size="lg"
                  className="w-full justify-center rounded-full py-3.5 shadow-lg"
                >
                  {isSubmitting ? "Completing Visit..." : "Complete Visit & Save Record ✓"}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
