"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { StepTracker } from "../../../components/ui/StepTracker";
import { createBookingSession } from "../../../lib/api/patients";
import { useAuth } from "../../../lib/AuthContext";

export default function SymptomFirstBookingPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [symptomsText, setSymptomsText] = useState(
    "I have had a severe throbbing headache on the right side of my head for 2 days with sensitivity to light."
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      }
    }
  }, [authStatus, user, router]);

  const handleSubmitSymptoms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomsText.trim()) {
      setErrorMsg("Please enter your symptoms to continue.");
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const session = await createBookingSession(symptomsText);
      router.push(`/patient/book/${session.sessionId}/doctors`);
    } catch (err: any) {
      console.error("Error starting booking session", err);
      setErrorMsg(err.message || "Failed to analyze symptoms. Please try again.");
      setIsSubmitting(false);
    }
  };

  const steps = [
    { label: "1. Symptoms", active: true },
    { label: "2. Choose Specialist", active: false },
    { label: "3. Choose Time Slot", active: false },
    { label: "4. Confirm", active: false },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-6">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
              Step 1 of 4
            </span>
            <h1 className="text-3xl font-black text-[#21322a]">
              Describe Your Symptoms
            </h1>
            <p className="text-xs text-[#587066]">
              Our AI care assistant will analyze your symptoms and suggest the most relevant medical specialist for your visit.
            </p>
          </div>

          {/* Plant Sprout Progress Tracker */}
          <StepTracker steps={steps} />
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
            <CardTitle className="text-lg font-bold">What symptoms are you experiencing?</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-4 pb-0">
            <form onSubmit={handleSubmitSymptoms} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f] mb-2">
                  Detailed Symptoms Description
                </label>
                <textarea
                  rows={5}
                  required
                  value={symptomsText}
                  onChange={(e) => setSymptomsText(e.target.value)}
                  placeholder="Describe your symptoms, when they started, severity, triggers, or any specific health concerns..."
                  className="w-full rounded-2xl border border-[#d7e2db] bg-white p-4 text-sm outline-none transition-all duration-200 focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="accent"
                  size="lg"
                  className="rounded-full shadow-lg"
                >
                  {isSubmitting ? "Analyzing Symptoms with AI..." : "Analyze Symptoms & Find Specialists →"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
