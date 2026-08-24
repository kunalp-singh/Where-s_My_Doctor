"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { completeDoctorProfile, WorkingHourItem } from "../../../lib/api/doctors";
import { useAuth } from "../../../lib/AuthContext";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SPECIALISATIONS = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Pediatrics",
  "Neurology",
  "Orthopedics",
  "Psychiatry",
];

export default function DoctorCompleteProfilePage() {
  const { user, authStatus, refreshSession } = useAuth();
  const router = useRouter();

  const [specialisation, setSpecialisation] = useState(SPECIALISATIONS[0]);
  const [slotDuration, setSlotDuration] = useState(30);
  const [dayConfigs, setDayConfigs] = useState<
    Array<{ enabled: boolean; startTime: string; endTime: string }>
  >(
    DAYS.map((_, idx) => ({
      enabled: idx < 5, // Enable Mon-Fri by default
      startTime: "09:00",
      endTime: "17:00",
    }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else if (user.status === "pending_approval") {
        router.push("/doctor/pending");
      } else if (user.status === "active") {
        router.push("/doctor");
      }
    }
  }, [authStatus, user, router]);

  const handleToggleDay = (idx: number) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleTimeChange = (idx: number, field: "startTime" | "endTime", value: string) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const workingHours: WorkingHourItem[] = dayConfigs
      .map((c, idx) => ({
        dayOfWeek: idx,
        startTime: c.startTime + ":00",
        endTime: c.endTime + ":00",
        enabled: c.enabled,
      }))
      .filter((h) => h.enabled);

    if (workingHours.length === 0) {
      setErrorMsg("Please select at least one active working day.");
      setIsSubmitting(false);
      return;
    }

    try {
      await completeDoctorProfile({
        specialisation,
        workingHours,
        slotDurationMinutes: slotDuration,
      });

      // Fetch updated status (which will now be pending_approval) and update context
      await refreshSession();
      router.push("/doctor/pending");
    } catch (err: any) {
      console.error("Failed to complete profile", err);
      setErrorMsg(err.message || "Failed to complete your profile. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-12 text-[#21322a]">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#3e6b63]">
            Google Account Registered
          </span>
          <h1 className="text-3xl font-black text-[#21322a]">Complete Your Doctor Profile</h1>
          <p className="text-xs text-[#587066] max-w-md mx-auto">
            Please provide your clinical specialisation and schedule settings to submit your application for administrative verification.
          </p>
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-8 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]">
            <CardTitle className="text-lg font-bold">Profile Details</CardTitle>
          </CardHeader>

          <CardBody className="px-0 pt-6 pb-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Specialisation */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                  Medical Specialisation
                </label>
                <select
                  value={specialisation}
                  onChange={(e) => setSpecialisation(e.target.value)}
                  className="w-full rounded-2xl border border-[#d7e2db] bg-white p-3.5 text-sm outline-none transition focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                >
                  {SPECIALISATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Slot Duration */}
              <div className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                  Consultation Slot Duration
                </label>
                <select
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="w-full rounded-2xl border border-[#d7e2db] bg-white p-3.5 text-sm outline-none transition focus:border-[#3e6b63] focus:ring-2 focus:ring-[#3e6b63]/20"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>

              {/* Working Hours */}
              <div className="space-y-4 pt-4 border-t border-[#d7e2db]/70">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#21322a]">
                    Weekly Practice Hours
                  </h3>
                  <p className="text-[11px] text-[#587066] mt-1">
                    Select the days you practice and configure your consultation hours.
                  </p>
                </div>

                <div className="space-y-3">
                  {dayConfigs.map((cfg, idx) => (
                    <div
                      key={DAYS[idx]}
                      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between transition ${
                        cfg.enabled
                          ? "border-[#3e6b63]/30 bg-white"
                          : "border-[#d7e2db] bg-[#f1f6f2]/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={() => handleToggleDay(idx)}
                          className="h-4 w-4 rounded border-[#d7e2db] text-[#3e6b63] focus:ring-[#3e6b63]"
                        />
                        <span className="text-sm font-bold text-[#21322a] w-24">
                          {DAYS[idx]}
                        </span>
                      </div>

                      {cfg.enabled && (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={cfg.startTime}
                            onChange={(e) => handleTimeChange(idx, "startTime", e.target.value)}
                            className="rounded-xl border border-[#d7e2db] bg-[#f9f7f1] px-3 py-1.5 text-xs outline-none focus:border-[#3e6b63]"
                          />
                          <span className="text-xs text-[#587066]">to</span>
                          <input
                            type="time"
                            value={cfg.endTime}
                            onChange={(e) => handleTimeChange(idx, "endTime", e.target.value)}
                            className="rounded-xl border border-[#d7e2db] bg-[#f9f7f1] px-3 py-1.5 text-xs outline-none focus:border-[#3e6b63]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="accent"
                  size="lg"
                  className="w-full justify-center rounded-full py-3.5 shadow-lg"
                >
                  {isSubmitting ? "Submitting Application..." : "Submit Doctor Registration ✓"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
