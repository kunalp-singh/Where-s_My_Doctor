"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { DoctorAdminResponse, listAdminDoctors } from "../../lib/api/admin";
import { useAuth } from "../../lib/AuthContext";

export default function AdminDashboardPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [doctors, setDoctors] = useState<DoctorAdminResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "admin") {
        router.push("/");
      } else {
        loadData();
      }
    }
  }, [authStatus, user, router]);

  const loadData = async () => {
    try {
      const docList = await listAdminDoctors();
      setDoctors(docList);
    } catch (err) {
      console.error("Error loading admin stats", err);
    } finally {
      setLoading(false);
    }
  };

  const activeDoctorsCount = doctors.filter((d) => d.status === "active").length;
  const pendingApprovalsCount = doctors.filter((d) => d.status === "pending_approval").length;

  if (authStatus === "loading" || loading) {
    return <div className="p-12 text-center text-[#587066]">Loading Admin Console...</div>;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#edf4ef] via-[#f8f6f0] to-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Organic Header */}
        <header
          className="flex flex-col gap-4 border border-[#d7e2db]/70 bg-[#f9f7f1]/90 p-8 backdrop-blur-md shadow-sm md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "30% 70% 45% 55% / 65% 35% 65% 35%" }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#3e6b63]">
              System Administration
            </p>
            <h1 className="mt-1 text-3xl font-black text-[#21322a]">
              Clinic Overview & Management
            </h1>
          </div>
          <Link href="/admin/doctors">
            <Button className="rounded-full bg-[#3e6b63] px-6 py-3 text-sm font-semibold text-white hover:bg-[#345b54] shadow-md">
              Manage Doctor Accounts
            </Button>
          </Link>
        </header>

        {/* Organic Summary Stat Containers (Pebble Shapes) */}
        <section className="grid gap-6 sm:grid-cols-4">
          <div
            className="p-6 bg-white border border-[#3e6b63]/20 shadow-sm transition-transform duration-200 hover:scale-105"
            style={{ borderRadius: "50% 50% 65% 35% / 40% 60% 40% 60%" }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#587066]">
              Active Doctors
            </span>
            <p className="mt-2 text-3xl font-black text-[#21322a]">{activeDoctorsCount}</p>
          </div>

          <div
            className="p-6 bg-red-50/70 border border-red-200 shadow-sm transition-transform duration-200 hover:scale-105"
            style={{ borderRadius: "35% 65% 55% 45% / 60% 40% 60% 40%" }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-red-800">
              Pending Approvals
            </span>
            <p className="mt-2 text-3xl font-black text-red-700">{pendingApprovalsCount}</p>
          </div>

          <div
            className="p-6 bg-[#f8f6f0] border border-[#d7e2db] shadow-sm transition-transform duration-200 hover:scale-105"
            style={{ borderRadius: "60% 40% 40% 60% / 45% 55% 45% 55%" }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#587066]">
              Total Appointments
            </span>
            <p className="mt-2 text-3xl font-black text-[#21322a]">12</p>
          </div>

          <div
            className="p-6 bg-[#dff0e5]/80 border border-[#bce2cb] shadow-sm transition-transform duration-200 hover:scale-105"
            style={{ borderRadius: "40% 60% 30% 70% / 55% 45% 55% 45%" }}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#23663d]">
              Celery Tasks
            </span>
            <p className="mt-2 text-3xl font-black text-[#23663d]">Active</p>
          </div>
        </section>

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <CardHeader className="px-0 pt-0 pb-4 border-b border-[#d7e2db]">
            <CardTitle className="text-lg font-bold">Quick Administrative Actions</CardTitle>
          </CardHeader>
          <CardBody className="px-0 pt-4 pb-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/admin/doctors" className="block rounded-2xl border border-[#d7e2db] bg-white p-5 hover:bg-[#edf4f1]">
                <h3 className="font-semibold text-[#21322a]">Doctor Approval Queue →</h3>
                <p className="mt-1 text-xs text-[#587066]">
                  {pendingApprovalsCount} doctor registration request(s) awaiting review.
                </p>
              </Link>

              <Link href="/admin/doctors" className="block rounded-2xl border border-[#d7e2db] bg-white p-5 hover:bg-[#edf4f1]">
                <h3 className="font-semibold text-[#21322a]">Add Doctor Accounts →</h3>
                <p className="mt-1 text-xs text-[#587066]">
                  Create direct active doctor accounts with predefined credentials.
                </p>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
