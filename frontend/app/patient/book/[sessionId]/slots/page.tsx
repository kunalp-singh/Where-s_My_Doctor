"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Badge } from "../../../../../components/ui/Badge";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../../components/ui/Card";
import { StepTracker } from "../../../../../components/ui/StepTracker";
import {
  DoctorSlot,
  getDoctorSlots,
  searchDoctors,
  sessionHoldAppointment,
} from "../../../../../lib/api/patients";
import { useAuth } from "../../../../../lib/AuthContext";

interface DateOption {
  dateStr: string; // ISO YYYY-MM-DD
  dayName: string; // Mon, Tue
  dateNumber: number; // 24
  monthName: string; // Aug
  isToday: boolean;
}

interface ShiftBlock {
  id: "morning" | "midday" | "evening";
  label: string;
  timeRange: string;
  icon: string;
  slots: DoctorSlot[];
}

function SlotSelectionContent() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const sessionId = params.sessionId as string;
  const doctorId = searchParams.get("doctorId");

  const [doctorName, setDoctorName] = useState("");
  const [doctorSpec, setDoctorSpec] = useState("");
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [daySlots, setDaySlots] = useState<DoctorSlot[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>("morning");

  const [loadingDoctor, setLoadingDoctor] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [holdingSlot, setHoldingSlot] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize doctor details & 14 rolling date options
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "patient") {
        router.push("/");
      } else if (!doctorId) {
        router.push(`/patient/book/${sessionId}/doctors`);
      } else {
        initPage();
      }
    }
  }, [authStatus, user, router, sessionId, doctorId]);

  const initPage = async () => {
    setLoadingDoctor(true);
    try {
      const allDocs = await searchDoctors();
      const doc = allDocs.find((d) => d.id === doctorId);
      if (doc) {
        setDoctorName(doc.name);
        setDoctorSpec(doc.specialisation);
      }

      // Build 14 rolling date options
      const dates: DateOption[] = [];
      const today = new Date();

      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const iso = `${yyyy}-${mm}-${dd}`;

        dates.push({
          dateStr: iso,
          dayName: d.toLocaleDateString([], { weekday: "short" }),
          dateNumber: d.getDate(),
          monthName: d.toLocaleDateString([], { month: "short" }),
          isToday: i === 0,
        });
      }

      setDateOptions(dates);
      if (dates.length > 0) {
        setSelectedDateStr(dates[0].dateStr);
      }
    } catch (err: any) {
      console.error("Error loading doctor details", err);
      setErrorMsg("Failed to load doctor details.");
    } finally {
      setLoadingDoctor(false);
    }
  };

  // Fetch slots whenever selectedDateStr changes
  useEffect(() => {
    if (!doctorId || !selectedDateStr) return;

    const fetchSlotsForDate = async () => {
      setLoadingSlots(true);
      setErrorMsg(null);
      try {
        const slotData = await getDoctorSlots(doctorId, selectedDateStr);
        setDaySlots(slotData);
      } catch (err: any) {
        console.error("Error loading slots for date", err);
        setErrorMsg("Failed to load slots for selected date.");
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlotsForDate();
  }, [doctorId, selectedDateStr]);

  // Categorize slots into Morning, Mid-Day, Evening shifts
  const morningSlots = daySlots.filter((s) => {
    const h = new Date(s.slotStart).getHours();
    return h >= 8 && h < 12;
  });

  const middaySlots = daySlots.filter((s) => {
    const h = new Date(s.slotStart).getHours();
    return h >= 12 && h < 15;
  });

  const eveningSlots = daySlots.filter((s) => {
    const h = new Date(s.slotStart).getHours();
    return h >= 15 && h <= 18;
  });

  const shifts: ShiftBlock[] = [
    {
      id: "morning",
      label: "Morning Shift",
      timeRange: "09:00 AM – 12:00 PM",
      icon: "🌅",
      slots: morningSlots,
    },
    {
      id: "midday",
      label: "Mid-Day Shift",
      timeRange: "12:00 PM – 03:00 PM",
      icon: "☀️",
      slots: middaySlots,
    },
    {
      id: "evening",
      label: "Afternoon / Evening Shift",
      timeRange: "03:00 PM – 06:00 PM",
      icon: "🌆",
      slots: eveningSlots,
    },
  ];

  const handleSelectSlot = async (slot: DoctorSlot) => {
    if (!doctorId || !slot.available) return;
    setHoldingSlot(slot.slotStart);
    setErrorMsg(null);

    try {
      await sessionHoldAppointment(sessionId, doctorId, slot.slotStart);
      router.push(`/patient/book/${sessionId}/confirm`);
    } catch (err: any) {
      console.error("Error holding slot", err);
      setErrorMsg(err.message || "Failed to hold selected slot. Please select another slot.");
      setHoldingSlot(null);
    }
  };

  const steps = [
    { label: "1. Symptoms", completed: true },
    { label: "2. Choose Specialist", completed: true },
    { label: "3. Choose Time Slot", active: true },
    { label: "4. Confirm", active: false },
  ];

  if (authStatus === "loading" || loadingDoctor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Fetching Specialist Details...
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
              Step 3 of 4
            </span>
            <h1 className="text-3xl font-black text-[#21322a]">
              Select Appointment Date & Time Block
            </h1>
          </div>

          <StepTracker steps={steps} />
        </header>

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 animate-in fade-in">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#3e6b63]">
                Selected Specialist
              </span>
              <CardTitle className="text-xl font-bold">{doctorName}</CardTitle>
              <p className="text-xs text-[#587066] font-medium">{doctorSpec}</p>
            </div>
            <Badge variant="calm">4.9 ★</Badge>
          </CardHeader>

          <CardBody className="px-0 pt-6 pb-0 space-y-6">
            {/* BookMyShow Style Date Selection Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                  Select Date (Next 14 Days)
                </label>
                {loadingSlots && (
                  <span className="text-xs text-[#3e6b63] font-semibold animate-pulse">
                    Updating slots...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {dateOptions.map((opt) => {
                  const isSelected = selectedDateStr === opt.dateStr;
                  return (
                    <button
                      key={opt.dateStr}
                      type="button"
                      onClick={() => setSelectedDateStr(opt.dateStr)}
                      className={`flex min-w-[76px] flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition-all duration-200 ${
                        isSelected
                          ? "border-[#3e6b63] bg-[#3e6b63] text-white shadow-md scale-105"
                          : "border-[#d7e2db] bg-white text-[#21322a] hover:border-[#3e6b63] hover:bg-[#edf4ef]"
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-white/80" : "text-[#587066]"}`}>
                        {opt.isToday ? "Today" : opt.dayName}
                      </span>
                      <span className="text-lg font-black">{opt.dateNumber}</span>
                      <span className={`text-[10px] font-semibold ${isSelected ? "text-white/80" : "text-[#587066]"}`}>
                        {opt.monthName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Shift Range Blocks */}
            <div className="space-y-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#42564f]">
                Select Time Shift Block
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                {shifts.map((shift) => {
                  const availableSlots = shift.slots.filter((s) => s.available);
                  const hasSlots = availableSlots.length > 0;
                  const isShiftSelected = selectedShift === shift.id;

                  return (
                    <div
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.id)}
                      className={`cursor-pointer rounded-2xl border p-5 transition-all duration-200 ${
                        isShiftSelected
                          ? "border-[#3e6b63] bg-[#edf4ef] shadow-sm"
                          : "border-[#d7e2db] bg-white hover:border-[#3e6b63]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl">{shift.icon}</span>
                        <Badge variant={hasSlots ? "calm" : "neutral"}>
                          {hasSlots ? `${availableSlots.length} Available` : "Full"}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-[#21322a] text-sm">{shift.label}</h3>
                      <p className="text-xs font-medium text-[#587066] mt-0.5">{shift.timeRange}</p>

                      <div className="mt-4 pt-3 border-t border-[#d7e2db]/70 space-y-2">
                        <span className="text-[10px] font-bold uppercase text-[#3e6b63] block">
                          Pick Time Slot:
                        </span>

                        {shift.slots.length === 0 ? (
                          <span className="text-xs text-[#76857c] italic">No slots scheduled</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {shift.slots.map((slot, i) => {
                              const isHolding = holdingSlot === slot.slotStart;
                              const isAvail = slot.available;
                              const timeStr = new Date(slot.slotStart).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={!isAvail || isHolding}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectSlot(slot);
                                  }}
                                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all duration-150 ${
                                    isHolding
                                      ? "border-[#3e6b63] bg-[#3e6b63] text-white scale-105 animate-pulse"
                                      : !isAvail
                                      ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through opacity-60"
                                      : "border-[#d7e2db] bg-[#f9f7f1] text-[#21322a] hover:border-[#3e6b63] hover:bg-[#3e6b63] hover:text-white shadow-sm"
                                  }`}
                                >
                                  {timeStr}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

export default function SlotSelectionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
        </div>
      }
    >
      <SlotSelectionContent />
    </Suspense>
  );
}
