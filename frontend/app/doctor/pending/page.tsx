"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "../../../components/ui/Card";
import { useAuth } from "../../../lib/AuthContext";

export default function DoctorPendingPage() {
  const { user, authStatus, refreshSession } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = async () => {
    setIsChecking(true);
    const updatedUser = await refreshSession();
    setIsChecking(false);
    if (updatedUser && updatedUser.status === "active") {
      router.push("/doctor");
    }
  };

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login");
    } else if (authStatus === "authenticated" && user) {
      if (user.role !== "doctor") {
        router.push("/");
      } else if (user.status === "active") {
        router.push("/doctor");
      }
    }
  }, [authStatus, user, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshSession().then((updatedUser) => {
        if (updatedUser && updatedUser.status === "active") {
          router.push("/doctor");
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshSession, router]);

  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#f1f6f2] p-6 text-[#21322a]">
      <Card className="w-full max-w-lg rounded-3xl border border-[#d7e2db] bg-[#f9f7f1] text-center shadow-[0_12px_40px_rgba(44,66,58,0.08)]">
        <CardHeader className="border-b border-[#d7e2db] px-6 py-6">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#edf4f1]">
            <svg
              className="h-8 w-8 text-[#3e6b63]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-[#21322a]">
            Account Under Review
          </CardTitle>
          <p className="mt-2 text-sm text-[#587066]">
            Thank you for registering, <strong className="text-[#21322a]">{user?.name}</strong>.
          </p>
        </CardHeader>
        <CardBody className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-[#d7e2db] bg-white p-4 text-left text-sm text-[#42564f]">
            <p className="font-semibold text-[#21322a]">What happens next?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#587066]">
              <li>Our clinic administrators review all credentials and specialisations.</li>
              <li>Your dashboard will automatically unlock as soon as your account is approved.</li>
              <li>Status auto-refreshes every 10 seconds while this window remains open.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button
              onClick={checkStatus}
              disabled={isChecking}
              className="rounded-full bg-[#3e6b63] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#345b54]"
            >
              {isChecking ? "Checking Status..." : "Check Approval Status"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

