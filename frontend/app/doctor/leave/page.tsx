"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { addDoctorLeaveDay } from "../../../lib/api/admin";
import { useAuth } from "../../../lib/AuthContext";

export default function DoctorLeavePage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [leaveDate, setLeaveDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [affectedCount, setAffectedCount] = useState<number | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      }
    }
  }, [authStatus, user, router]);

  const handleMarkLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDate || !user) return;

    setErrorMsg(null);
    setStatusMsg(null);
    setIsSubmitting(true);

    try {
      const res = await addDoctorLeaveDay(user.id, leaveDate);
      if (res && res.affectedBookingCount > 0) {
        setAffectedCount(res.affectedBookingCount);
        setShowWarningModal(true);
      } else {
        setStatusMsg(`Leave date ${leaveDate} scheduled successfully with zero booking conflicts.`);
      }
      setLeaveDate("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to schedule leave day.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <Link href="/doctor" className="text-xs font-semibold uppercase tracking-widest text-[#3e6b63] hover:underline">
            ← Back to Doctor Console
          </Link>
          <h1 className="mt-1 text-3xl font-bold text-[#21322a]">
            Schedule Doctor Leave
          </h1>
        </header>

        {statusMsg && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]">
            <CardTitle className="text-lg font-bold">Mark Unavailable Date</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-4 pb-0">
            <form onSubmit={handleMarkLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#42564f]">
                  Select Leave Date
                </label>
                <input
                  type="date"
                  required
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-sm outline-none focus:border-[#3e6b63]"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full justify-center rounded-full bg-[#3e6b63] py-3 text-sm font-semibold text-white hover:bg-[#345b54]"
              >
                {isSubmitting ? "Scheduling Leave..." : "Schedule Leave Day"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Modal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          title="Schedule Conflict Warning"
        >
          <div className="space-y-4 text-sm text-[#42564f]">
            <p>
              Marking this leave day affected <strong className="text-[#21322a]">{affectedCount} active patient booking(s)</strong>.
            </p>
            <p className="text-xs text-[#587066]">
              The system automatically notified the affected patients via email and issued cancellation notices so they can reschedule their visits.
            </p>
            <div className="pt-2 flex justify-end">
              <Button onClick={() => setShowWarningModal(false)} className="rounded-full bg-[#3e6b63] px-5 py-2 text-xs font-semibold text-white">
                Understood
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}

