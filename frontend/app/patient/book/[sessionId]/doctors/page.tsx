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
  updateBookingSession,
} from "../../../../../lib/api/patients";
import { useAuth } from "../../../../../lib/AuthContext";

const specialisations = [
  "General Physician",
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Neurology",
  "Orthopedics",
  "Psychiatry",
];

export default function DoctorSelectionPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<BookingSession | null>(null);
  const [selectedSpec, setSelectedSpec] = useState("General Medicine");
  const [allDoctors, setAllDoctors] = useState<DoctorSearchResult[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<DoctorSearchResult[]>([]);
  const [isShowingAll, setIsShowingAll] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      } else {
        initSession();
      }
    }
  }, [authStatus, user, router, sessionId]);

  const initSession = async () => {
    setLoading(true);
    try {
      const sess = await getBookingSession(sessionId);
      setSession(sess);

      const rec = sess.recommendedSpecialisation || "General Medicine";
      setSelectedSpec(rec);

      const docs = await searchDoctors();
      setAllDoctors(docs);

      filterDoctorList(docs, rec, false);
    } catch (err: any) {
      console.error("Error loading booking session", err);
      setErrorMsg("Failed to load booking session details.");
    } finally {
      setLoading(false);
    }
  };

  const filterDoctorList = (docsList: DoctorSearchResult[], spec: string, showAll: boolean) => {
    if (showAll) {
      setFilteredDoctors(docsList);
      return;
    }

    if (spec === "General Physician" || spec === "General Medicine") {
      const matching = docsList.filter(
        (d) =>
          d.specialisation.toLowerCase().includes("general") ||
          d.specialisation.toLowerCase().includes("physician") ||
          d.specialisation.toLowerCase().includes("medicine")
      );
      setFilteredDoctors(matching.length > 0 ? matching : docsList);
    } else {
      const matching = docsList.filter(
        (d) => d.specialisation.toLowerCase() === spec.toLowerCase()
      );
      setFilteredDoctors(matching.length > 0 ? matching : docsList);
    }
  };

  const handleSpecChange = async (newSpec: string) => {
    setSelectedSpec(newSpec);
    setIsShowingAll(false);
    filterDoctorList(allDoctors, newSpec, false);
    try {
      await updateBookingSession(sessionId, { recommendedSpecialisation: newSpec });
    } catch (err) {
      console.error("Error updating session specialisation", err);
    }
  };

  const handleBrowseAll = () => {
    setIsShowingAll(true);
    filterDoctorList(allDoctors, selectedSpec, true);
  };

  const handleSelectDoctor = async (doc: DoctorSearchResult) => {
    try {
      await updateBookingSession(sessionId, { doctorId: doc.id });
      router.push(`/patient/book/${sessionId}/slots?doctorId=${doc.id}`);
    } catch (err: any) {
      setErrorMsg("Failed to select doctor. Please try again.");
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Analyzing Symptoms & Finding Specialists...
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    { label: "1. Symptoms", completed: true },
    { label: "2. Choose Specialist", active: true },
    { label: "3. Choose Time Slot", active: false },
    { label: "4. Confirm", active: false },
  ];

  const urgencyTone = session?.aiSummary?.urgency === "high" ? "urgent" : "calm";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
              Step 2 of 4
            </span>
            <h1 className="text-3xl font-black text-[#21322a]">
              AI Triage & Recommended Specialist
            </h1>
          </div>

          <StepTracker steps={steps} />
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        {/* AI Triage Card */}
        {session?.aiSummary && (
          <AIInsightCard
            title="AI Pre-Visit Triage Assessment"
            summary={`Chief Complaint: ${session.aiSummary.chiefComplaint || session.symptomsText}`}
            insights={
              session.aiSummary.followUpQuestions || [
                "What triggers or relieves these symptoms?",
                "How long have you experienced this?",
              ]
            }
            tone={urgencyTone}
          />
        )}

        {/* Recommendation Banner */}
        <Card className="rounded-3xl border border-[#bce2cb] bg-gradient-to-br from-[#dff0e5] to-[#edf4ef] p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <h2 className="text-base font-bold text-[#21322a]">
                  Specialist Recommendation
                </h2>
              </div>
              <p className="text-xs text-[#2e5e54]">
                Based on your symptoms, we suggest seeing a{" "}
                <strong className="underline decoration-[#3e6b63]">{selectedSpec}</strong>{" "}
                specialist.
              </p>
            </div>

            <div className="min-w-[200px]">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#42564f] mb-1">
                Change Specialisation
              </label>
              <select
                value={selectedSpec}
                onChange={(e) => handleSpecChange(e.target.value)}
                className="w-full rounded-2xl border border-[#bce2cb] bg-white p-2.5 text-xs font-semibold outline-none focus:border-[#3e6b63]"
              >
                {specialisations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* Doctor List */}
        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70 flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold">
                {isShowingAll ? "All Available Doctors" : `${selectedSpec} Doctors`}
              </CardTitle>

              <p className="text-xs text-[#587066] mt-0.5">
                {isShowingAll
                  ? `Showing all ${filteredDoctors.length} doctors across specialisations`
                  : `Filtered by ${selectedSpec} (${filteredDoctors.length} available)`}
              </p>
            </div>
            {isShowingAll && (
              <button
                type="button"
                onClick={() => handleSpecChange(selectedSpec)}
                className="text-xs font-bold text-[#3e6b63] hover:underline"
              >
                Re-apply {selectedSpec} filter
              </button>
            )}
          </CardHeader>

          <CardBody className="px-0 pt-4 pb-0 space-y-4">
            {filteredDoctors.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#587066]">
                No doctors found for {selectedSpec}. Try browsing all doctors below.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#d7e2db] bg-white p-4 transition-all duration-200 hover:border-[#3e6b63] hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-[#21322a] text-base">{doc.name}</h3>
                      <p className="text-xs text-[#587066] font-medium">{doc.specialisation}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="calm">4.9 ★</Badge>
                      <Button
                        onClick={() => handleSelectDoctor(doc)}
                        variant="primary"
                        size="sm"
                        className="rounded-full"
                      >
                        Select Doctor & View Slots →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clear "Browse all doctors" Button */}
            {!isShowingAll && (
              <div className="pt-4 border-t border-[#d7e2db]/70 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBrowseAll}
                  className="rounded-full text-xs font-bold text-[#3e6b63] hover:bg-[#edf4ef]"
                >
                  🔍 Browse all doctors across all specialisations
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

