"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DoctorAppointmentItem, listDoctorAppointments } from "../../lib/api/doctors";
import { useAuth } from "../../lib/AuthContext";

export default function DoctorDashboardPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<DoctorAppointmentItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [timeFilter, setTimeFilter] = useState<"today" | "all">("all");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else if (user.status === "pending_approval") {
        router.push("/doctor/pending");
      } else {
        loadQueue();
      }
    }
  }, [authStatus, user, router]);

  const loadQueue = async () => {
    try {
      const data = await listDoctorAppointments();
      const sorted = [...data].sort(
        (a, b) => new Date(b.slotStart).getTime() - new Date(a.slotStart).getTime()
      );
      setAppointments(sorted);
    } catch (err) {
      console.error("Error loading doctor appointments", err);
    } finally {
      setLoadingData(false);
    }
  };

  if (authStatus === "loading" || loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f1f6f2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d7e2db] border-t-[#3e6b63]" />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#587066]">
            Loading Doctor Console...
          </p>
        </div>
      </div>
    );
  }

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayLocalStr = `${yyyy}-${mm}-${dd}`;

  // Filter into Pending Active Queue vs Completed History
  const activeQueue = appointments.filter(
    (apt) => apt.status === "booked" || apt.status === "held"
  );
  const completedHistory = appointments.filter((apt) => apt.status === "completed");
  const urgentCount = activeQueue.filter((apt) => apt.urgency === "high" || apt.urgency === "urgent").length;

  const currentTabAppointments = activeTab === "queue" ? activeQueue : completedHistory;

  const displayedAppointments = currentTabAppointments.filter((apt) => {
    if (timeFilter === "today") {
      const aptDate = new Date(apt.slotStart);
      const aptYyyy = aptDate.getFullYear();
      const aptMm = String(aptDate.getMonth() + 1).padStart(2, "0");
      const aptDd = String(aptDate.getDate()).padStart(2, "0");
      const aptLocalStr = `${aptYyyy}-${aptMm}-${aptDd}`;
      return aptLocalStr === todayLocalStr || apt.slotStart.slice(0, 10) === todayLocalStr;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Organic Header */}
        <header
          className="flex flex-col gap-4 border border-[#d7e2db]/70 bg-[#f9f7f1]/90 p-8 backdrop-blur-md shadow-sm md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "35% 65% 50% 50% / 60% 40% 60% 40%" }}
        >
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dff0e5] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#23663d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#23663d]" />
              Doctor Console
            </span>
            <h1 className="text-3xl font-black tracking-tight text-[#21322a]">
              Welcome, Dr. {user?.name}
            </h1>
            <p className="text-xs text-[#587066]">
              Review patient symptoms, AI triage notes, and launch clinical consultations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/doctor/schedule">
              <Button variant="accent" size="md" className="rounded-full shadow-md">
                Manage Schedule & Free Slots
              </Button>
            </Link>
            <Link href="/doctor/leave">
              <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold text-[#3e6b63]">
                Manage Leave Days
              </Button>
            </Link>
          </div>
        </header>

        {/* Organic Summary Stat Containers */}
        <div className="grid gap-6 sm:grid-cols-3">
          <div
            className="p-6 bg-white border border-[#3e6b63]/20 shadow-sm space-y-2 transition-transform duration-200 hover:scale-[1.02]"
            style={{ borderRadius: "50% 50% 65% 35% / 40% 60% 40% 60%" }}
          >
            <span className="text-2xl">⏳</span>
            <h3 className="text-2xl font-black text-[#21322a]">{activeQueue.length}</h3>
            <p className="text-xs font-bold text-[#3e6b63] uppercase tracking-wider">
              Pending Consultations
            </p>
          </div>

          <div
            className="p-6 bg-[#f8f6f0] border border-[#d7e2db] shadow-sm space-y-2 transition-transform duration-200 hover:scale-[1.02]"
            style={{ borderRadius: "35% 65% 55% 45% / 60% 40% 60% 40%" }}
          >
            <span className="text-2xl">✓</span>
            <h3 className="text-2xl font-black text-[#21322a]">{completedHistory.length}</h3>
            <p className="text-xs font-bold text-[#587066] uppercase tracking-wider">
              Completed Records
            </p>
          </div>

          <div
            className="p-6 bg-red-50/70 border border-red-200 shadow-sm space-y-2 transition-transform duration-200 hover:scale-[1.02]"
            style={{ borderRadius: "60% 40% 40% 60% / 45% 55% 45% 55%" }}
          >
            <span className="text-2xl">🚨</span>
            <h3 className="text-2xl font-black text-red-700">{urgentCount}</h3>
            <p className="text-xs font-bold text-red-800 uppercase tracking-wider">
              High Urgency Cases
            </p>
          </div>
        </div>

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          {/* Main Navigation Tabs: Active Queue vs Completed History */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#d7e2db]/70 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={`relative pb-2 text-base font-bold transition-all duration-200 ${
                  activeTab === "queue"
                    ? "text-[#3e6b63] border-b-2 border-[#3e6b63]"
                    : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                Active Patient Queue
                <span className="ml-2 rounded-full bg-[#dff0e5] px-2.5 py-0.5 text-xs font-bold text-[#23663d]">
                  {activeQueue.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={`relative pb-2 text-base font-bold transition-all duration-200 ${
                  activeTab === "history"
                    ? "text-[#3e6b63] border-b-2 border-[#3e6b63]"
                    : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                Completed Visit Records
                <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700">
                  {completedHistory.length}
                </span>
              </button>
            </div>

            <div className="flex rounded-full border border-[#d7e2db] bg-white p-1 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setTimeFilter("today")}
                className={`rounded-full px-4 py-1 text-xs font-bold transition-all duration-200 ${
                  timeFilter === "today" ? "bg-[#3e6b63] text-white shadow-sm" : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter("all")}
                className={`rounded-full px-4 py-1 text-xs font-bold transition-all duration-200 ${
                  timeFilter === "all" ? "bg-[#3e6b63] text-white shadow-sm" : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                All Dates
              </button>
            </div>
          </div>

          <div className="pt-5 space-y-3">
            {displayedAppointments.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#587066]">
                {activeTab === "queue"
                  ? "No active pending appointments in your queue for this view."
                  : "No completed visit records found."}
              </div>
            ) : (
              displayedAppointments.map((apt) => {
                const startDate = new Date(apt.slotStart);
                const dateStr = startDate.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                const timeStr = startDate.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const isCompleted = apt.status === "completed";

                return (
                  <div
                    key={apt.id || apt.appointmentId}
                    className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                      isCompleted
                        ? "border-[#d7e2db]/70 bg-gray-50/60 hover:bg-white"
                        : "border-[#d7e2db] bg-white hover:border-[#3e6b63] hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          isCompleted
                            ? "bg-gray-400"
                            : apt.urgency === "high" || apt.urgency === "urgent"
                            ? "bg-[#c94f4f] animate-pulse"
                            : "bg-[#3e6b63]"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#21322a] text-base">
                            {apt.patientName || `Patient #${(apt.patientId || "").slice(-4)}`}
                          </h3>
                          {isCompleted && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-md">
                              ✓ Completed
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#3e6b63]">
                          {dateStr} • {timeStr}
                        </p>
                        {apt.chiefComplaint && (
                          <p className="text-xs text-[#587066] mt-0.5 max-w-md line-clamp-1">
                            Complaint: {apt.chiefComplaint}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant={apt.urgency === "high" || apt.urgency === "urgent" ? "urgent" : "calm"}>
                        {(apt.urgency || "routine").toUpperCase()}
                      </Badge>
                      
                      {isCompleted ? (
                        <Link href={`/doctor/appointments/${apt.id || apt.appointmentId}`}>
                          <Button variant="ghost" size="sm" className="rounded-full text-xs font-bold border border-[#d7e2db] bg-white text-[#3e6b63] hover:bg-[#edf4ef]">
                            View Saved Record 🔒
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/doctor/appointments/${apt.id || apt.appointmentId}`}>
                          <Button variant="primary" size="sm" className="rounded-full shadow-sm">
                            Start Consultation →
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
