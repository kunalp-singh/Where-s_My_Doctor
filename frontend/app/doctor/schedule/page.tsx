"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import {
  DoctorSchedule,
  getDoctorSchedule,
  updateDoctorSchedule,
  WorkingHourItem,
} from "../../../lib/api/doctors";
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

const PRESET_SHIFTS = [
  { label: "Full Day (09:00 - 17:00)", start: "09:00", end: "17:00" },
  { label: "Morning Shift (09:00 - 11:30)", start: "09:00", end: "11:30" },
  { label: "Mid-Day Shift (11:30 - 14:30)", start: "11:30", end: "14:30" },
  { label: "Afternoon Shift (15:00 - 17:30)", start: "15:00", end: "17:30" },
];

export default function DoctorSchedulePage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [slotDuration, setSlotDuration] = useState(30);
  const [dayConfigs, setDayConfigs] = useState<
    Array<{ enabled: boolean; startTime: string; endTime: string }>
  >(
    DAYS.map(() => ({ enabled: true, startTime: "09:00", endTime: "17:00" }))
  );

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else {
        loadSchedule();
      }
    }
  }, [authStatus, user, router]);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const data: DoctorSchedule = await getDoctorSchedule();
      setSlotDuration(data.slotDurationMinutes || 30);

      const configs = DAYS.map((_, dayIdx) => {
        const found = data.workingHours.find((h) => h.dayOfWeek === dayIdx);
        if (found) {
          return {
            enabled: true,
            startTime: found.startTime.slice(0, 5),
            endTime: found.endTime.slice(0, 5),
          };
        }
        return { enabled: false, startTime: "09:00", endTime: "17:00" };
      });

      setDayConfigs(configs);
    } catch (err: any) {
      console.error("Error loading doctor schedule", err);
      setErrorMsg("Failed to load schedule settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (idx: number) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleApplyPresetShift = (idx: number, start: string, end: string) => {
    setDayConfigs((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, enabled: true, startTime: start, endTime: end } : c
      )
    );
  };

  const handleTimeChange = (
    idx: number,
    field: "startTime" | "endTime",
    val: string
  ) => {
    setDayConfigs((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);

    const workingHours: WorkingHourItem[] = dayConfigs
      .map((c, idx) => ({
        dayOfWeek: idx,
        startTime: c.startTime.length === 5 ? `${c.startTime}:00` : c.startTime,
        endTime: c.endTime.length === 5 ? `${c.endTime}:00` : c.endTime,
        enabled: c.enabled,
      }))
      .filter((c) => c.enabled)
      .map(({ dayOfWeek, startTime, endTime }) => ({
        dayOfWeek,
        startTime,
        endTime,
      }));

    try {
      await updateDoctorSchedule({
        workingHours,
        slotDurationMinutes: Number(slotDuration),
      });
      setStatusMsg("Shift blocks and time slot availability updated successfully!");
    } catch (err: any) {
      console.error("Error saving schedule", err);
      setErrorMsg(err.message || "Failed to update schedule settings.");
    } finally {
      setSaving(false);
    }
  };

  if (authStatus === "loading" || loading) {
    return (
      <div className="p-12 text-center text-[#587066]">
        Loading Schedule Settings...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link
            href="/doctor"
            className="text-xs font-bold uppercase tracking-widest text-[#3e6b63] hover:underline"
          >
            ← Back to Doctor Console
          </Link>
          <h1 className="mt-1 text-3xl font-black text-[#21322a]">
            Manage Shift Blocks & Free Slots
          </h1>
          <p className="text-xs text-[#587066]">
            Configure your shift availability blocks and appointment slot duration for patients.
          </p>
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

        <form onSubmit={handleSaveSchedule} className="space-y-6">
          <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
            <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
              <CardTitle className="text-lg font-bold">
                Appointment Slot Duration
              </CardTitle>
            </CardHeader>
            <CardBody className="px-0 pt-4 pb-0 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                  Duration per Slot Block
                </label>
                <select
                  value={slotDuration}
                  onChange={(e) => setSlotDuration(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none focus:border-[#3e6b63]"
                >
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes (Standard)</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
            </CardBody>
          </Card>

          <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
            <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70">
              <CardTitle className="text-lg font-bold">
                Shift Block Availability by Day
              </CardTitle>
            </CardHeader>
            <CardBody className="px-0 pt-4 pb-0 space-y-4">
              {DAYS.map((dayName, idx) => {
                const config = dayConfigs[idx];
                return (
                  <div
                    key={dayName}
                    className="flex flex-col gap-3 rounded-2xl border border-[#d7e2db] bg-white p-4 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={() => handleToggleDay(idx)}
                          className="h-5 w-5 rounded border-[#d7e2db] accent-[#3e6b63]"
                        />
                        <span className="font-bold text-sm text-[#21322a]">
                          {dayName}
                        </span>
                      </div>

                      {config.enabled ? (
                        <div className="flex items-center gap-2 text-xs">
                          <input
                            type="time"
                            value={config.startTime}
                            onChange={(e) =>
                              handleTimeChange(idx, "startTime", e.target.value)
                            }
                            className="rounded-xl border border-[#d7e2db] bg-[#f9f7f1] px-3 py-1.5 text-xs outline-none focus:border-[#3e6b63]"
                          />
                          <span className="text-[#587066]">to</span>
                          <input
                            type="time"
                            value={config.endTime}
                            onChange={(e) =>
                              handleTimeChange(idx, "endTime", e.target.value)
                            }
                            className="rounded-xl border border-[#d7e2db] bg-[#f9f7f1] px-3 py-1.5 text-xs outline-none focus:border-[#3e6b63]"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-[#90a49b] font-medium">
                          Unavailable
                        </span>
                      )}
                    </div>

                    {config.enabled && (
                      <div className="pt-2 border-t border-[#f1f6f2] flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase text-[#587066] mr-1">
                          Quick Presets:
                        </span>
                        {PRESET_SHIFTS.map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              handleApplyPresetShift(idx, preset.start, preset.end)
                            }
                            className="rounded-full border border-[#d7e2db] bg-[#f9f7f1] px-2.5 py-1 text-[10px] font-semibold text-[#21322a] hover:bg-[#edf4ef] hover:border-[#3e6b63]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                type="submit"
                disabled={saving}
                variant="accent"
                size="lg"
                className="mt-4 w-full justify-center rounded-full py-3.5 shadow-lg"
              >
                {saving ? "Saving Schedule..." : "Save Shift Blocks & Free Slots 🌸"}
              </Button>
            </CardBody>
          </Card>
        </form>
      </div>
    </main>
  );
}
