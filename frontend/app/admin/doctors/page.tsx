"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { approveDoctor, createAdminDoctor, deleteAdminDoctor, DoctorAdminResponse, listAdminDoctors, rejectDoctor } from "../../../lib/api/admin";
import { useAuth } from "../../../lib/AuthContext";

export default function AdminDoctorsPage() {
  const { user, authStatus } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const [doctors, setDoctors] = useState<DoctorAdminResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocEmail, setNewDocEmail] = useState("");
  const [newDocPassword, setNewDocPassword] = useState("");
  const [newDocSpec, setNewDocSpec] = useState("General Medicine");

  // Delete State
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "admin") {
        router.push("/");
      } else {
        fetchDoctors();
      }
    }
  }, [authStatus, user, router]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await listAdminDoctors();
      setDoctors(data);
    } catch (err) {
      console.error("Error listing admin doctors", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (docId: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await approveDoctor(docId);
      setStatusMsg("Doctor account approved successfully!");
      fetchDoctors();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to approve doctor.");
    }
  };

  const handleReject = async (docId: string) => {
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await rejectDoctor(docId);
      setStatusMsg("Doctor account application rejected.");
      fetchDoctors();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reject doctor.");
    }
  };

  const handleDeleteDoctor = async (docId: string) => {
    if (!window.confirm("Are you sure you want to delete this doctor? This action cannot be undone.")) {
      return;
    }
    setErrorMsg(null);
    setStatusMsg(null);
    setDeletingDocId(docId);
    try {
      await deleteAdminDoctor(docId);
      setStatusMsg("Doctor account deleted from directory.");
      fetchDoctors();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete doctor.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    setIsSubmitting(true);

    try {
      await createAdminDoctor({
        name: newDocName,
        email: newDocEmail,
        password: newDocPassword,
        specialisation: newDocSpec,
      });

      setStatusMsg(`Doctor profile for ${newDocName} created!`);
      setShowAddModal(false);
      setNewDocName("");
      setNewDocEmail("");
      setNewDocPassword("");
      fetchDoctors();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create doctor profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeDoctors = doctors.filter((d) => d.status === "active");
  const pendingDoctors = doctors.filter((d) => d.status === "pending_approval");

  if (authStatus === "loading" || loading) {
    return <div className="p-12 text-center text-[#587066]">Loading Doctor Directory...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f1f6f2] px-6 py-10 text-[#21322a]">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin" className="text-xs font-semibold uppercase tracking-widest text-[#3e6b63] hover:underline">
              ← Back to Admin Console
            </Link>
            <h1 className="mt-1 text-3xl font-bold text-[#21322a]">
              Doctor Management
            </h1>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="rounded-full bg-[#3e6b63] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#345b54]"
          >
            + Add New Doctor
          </Button>
        </header>

        {statusMsg && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-800">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
            {errorMsg}
          </div>
        )}

        <Card className="rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#d7e2db] pb-4">
            <div className="flex rounded-full border border-[#d7e2db] bg-white p-1">
              <button
                type="button"
                onClick={() => setActiveTab("active")}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                  activeTab === "active" ? "bg-[#3e6b63] text-white" : "text-[#587066]"
                }`}
              >
                Active Doctors ({activeDoctors.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className={`rounded-full px-5 py-2 text-xs font-semibold transition ${
                  activeTab === "pending" ? "bg-[#3e6b63] text-white" : "text-[#587066]"
                }`}
              >
                Pending Approval ({pendingDoctors.length})
              </button>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            {activeTab === "active" ? (
              activeDoctors.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#587066]">No active doctors found.</p>
              ) : (
                activeDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#d7e2db] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-[#21322a] text-base">{doc.name}</h3>
                      <p className="text-xs text-[#587066]">
                        {doc.email} · {doc.specialisation || "General Practice"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="calm">ACTIVE</Badge>
                      <Button
                        variant="secondary"
                        onClick={() => handleDeleteDoctor(doc.id)}
                        disabled={deletingDocId === doc.id}
                        className="rounded-full bg-[#fdf2f2] px-3.5 py-1.5 text-xs font-semibold text-[#c94f4f] hover:bg-[#f8e4e4]"
                      >
                        {deletingDocId === doc.id ? "Deleting..." : "Delete Doctor"}
                      </Button>
                    </div>
                  </div>
                ))
              )
            ) : pendingDoctors.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#587066]">No pending doctor approval requests.</p>
            ) : (
              pendingDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[#d7e2db] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#21322a]">{doc.name}</h3>
                      <Badge variant="urgent">PENDING APPROVAL</Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#587066]">
                      {doc.email} · Specialisation: {doc.specialisation || "General Medicine"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleApprove(doc.id)}
                      className="rounded-full bg-[#3e6b63] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#345b54]"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleReject(doc.id)}
                      className="rounded-full bg-[#fdf2f2] px-4 py-1.5 text-xs font-semibold text-[#c94f4f] hover:bg-[#f8e4e4]"
                    >
                      Reject
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleDeleteDoctor(doc.id)}
                      className="rounded-full bg-[#fdf2f2] px-3.5 py-1.5 text-xs font-semibold text-[#c94f4f] hover:bg-[#f8e4e4]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Create Direct Doctor Profile"
        >
          <form onSubmit={handleAddDoctor} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#42564f]">
                Full Name
              </label>
              <input
                type="text"
                required
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Dr. Evelyn Vance"
                className="mt-1 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-xs outline-none focus:border-[#3e6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#42564f]">
                Email Address
              </label>
              <input
                type="email"
                required
                value={newDocEmail}
                onChange={(e) => setNewDocEmail(e.target.value)}
                placeholder="evelyn@appointmentcare.local"
                className="mt-1 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-xs outline-none focus:border-[#3e6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#42564f]">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newDocPassword}
                onChange={(e) => setNewDocPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-xs outline-none focus:border-[#3e6b63]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#42564f]">
                Specialisation
              </label>
              <input
                type="text"
                required
                value={newDocSpec}
                onChange={(e) => setNewDocSpec(e.target.value)}
                placeholder="Cardiology, General Medicine..."
                className="mt-1 w-full rounded-2xl border border-[#d7e2db] bg-white p-3 text-xs outline-none focus:border-[#3e6b63]"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center rounded-full bg-[#3e6b63] py-2.5 text-xs font-semibold text-white hover:bg-[#345b54]"
            >
              {isSubmitting ? "Creating Doctor..." : "Create Active Doctor Profile"}
            </Button>
          </form>
        </Modal>
      </div>
    </main>
  );
}
