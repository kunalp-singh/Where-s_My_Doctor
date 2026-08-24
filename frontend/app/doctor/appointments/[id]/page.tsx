"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AIInsightCard } from "../../../../components/ui/AIInsightCard";
import { Button } from "../../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../components/ui/Card";
import { DoctorNotesResponse, getVisitDetail, submitVisitNotes } from "../../../../lib/api/doctors";
import { useAuth } from "../../../../lib/AuthContext";

interface PrescriptionRow {
  medicationName: string;
  dosage: string;
  frequency: string;
}

export default function DoctorConsultationPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;

  const [visitDetail, setVisitDetail] = useState<DoctorNotesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([
    { medicationName: "", dosage: "", frequency: "Daily" },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else {
        loadDetail();
      }
    }
  }, [authStatus, user, router]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getVisitDetail(appointmentId);
      setVisitDetail(data);
      setDiagnosis(data.diagnosis || "");
      setNotes(data.notes || "");
      if (data.prescriptions && data.prescriptions.length > 0) {
        setPrescriptions(data.prescriptions);
      }
    } catch (err) {
      console.error("Error loading visit detail", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrescriptionRow = () => {
    setPrescriptions([...prescriptions, { medicationName: "", dosage: "", frequency: "Daily" }]);
  };

  const handlePrescriptionChange = (index: number, field: keyof PrescriptionRow, value: string) => {
    const updated = [...prescriptions];
    updated[index][field] = value;
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
      const res = await submitVisitNotes(appointmentId, {
        chiefComplaint: visitDetail?.chiefComplaint || "Routine consultation",
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/doctor" className="text-xs font-bold uppercase tracking-widest text-[#3e6b63] hover:underline">
              ← Back to Patient Queue
            </Link>
            <h1 className="mt-1 text-3xl font-black text-[#21322a]">
              Consultation: {visitDetail?.patientName || "Patient Visit"}
            </h1>
          </div>
        </header>

        {statusMsg && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800 animate-in fade-in">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <AIInsightCard
          title="Pre-Visit AI Insight & Triage"
          summary={visitDetail?.chiefComplaint || "No pre-visit symptoms submitted by patient."}
          insights={[
            `Patient: ${visitDetail?.patientName || 'Patient'}`,
            `Pre-Submitted Complaint: ${visitDetail?.chiefComplaint || 'Standard Routine Visit'}`,
          ]}
          tone="calm"
        />

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
            <CardTitle className="text-lg font-bold">Clinical Notes & Prescriptions</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-4 pb-0">
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
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
