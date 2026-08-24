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
  const [viewMode, setViewMode] = useState<"today" | "all">("all");

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
      setAppointments(data);
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

  const displayedAppointments = appointments.filter((apt) => {
    if (viewMode === "today") {
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
        <header className="flex flex-col gap-4 rounded-3xl border border-[#d7e2db]/70 bg-[#f9f7f1]/80 p-8 backdrop-blur-md shadow-[0_8px_30px_rgba(44,66,58,0.06)] md:flex-row md:items-center md:justify-between">
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

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d7e2db]/70 pb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#21322a]">Patient Queue</h2>
              <p className="text-xs text-[#587066]">
                {displayedAppointments.length} patient appointments in queue
              </p>
            </div>
            <div className="flex rounded-full border border-[#d7e2db] bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("today")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
                  viewMode === "today" ? "bg-[#3e6b63] text-white shadow-sm" : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                Today's Queue
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
                  viewMode === "all" ? "bg-[#3e6b63] text-white shadow-sm" : "text-[#587066] hover:text-[#21322a]"
                }`}
              >
                All Scheduled
              </button>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            {displayedAppointments.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#587066]">
                No scheduled patient appointments in your queue for this view.
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

                return (
                  <div
                    key={apt.id || apt.appointmentId}
                    className="flex flex-col gap-3 rounded-2xl border border-[#d7e2db] bg-white p-4 transition-all duration-200 hover:border-[#3e6b63] hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          apt.urgency === "high" || apt.urgency === "urgent"
                            ? "bg-[#c94f4f] animate-pulse"
                            : "bg-[#3e6b63]"
                        }`}
                      />
                      <div>
                        <h3 className="font-bold text-[#21322a] text-base">
                          {apt.patientName || `Patient #${(apt.patientId || "").slice(-4)}`}
                        </h3>
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
                      <Badge variant="neutral">{apt.status.toUpperCase()}</Badge>
                      <Link href={`/doctor/appointments/${apt.id || apt.appointmentId}`}>
                        <Button variant="primary" size="sm" className="rounded-full">
                          Start Consultation →
                        </Button>
                      </Link>
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
