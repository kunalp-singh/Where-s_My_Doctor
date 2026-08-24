"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/AuthContext";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="border-b border-[#d7e2db] bg-white px-6 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-[#21322a]">Appointment Care</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {user.role === "patient" && (
                <Link href="/patient" className="text-sm font-medium text-[#42564f] hover:text-[#21322a]">
                  Patient Portal
                </Link>
              )}
              {user.role === "doctor" && (
                user.status === "pending_approval" ? (
                  <Link href="/doctor/pending" className="text-sm font-medium text-amber-700 hover:text-amber-900">
                    Pending Approval
                  </Link>
                ) : (
                  <Link href="/doctor" className="text-sm font-medium text-[#42564f] hover:text-[#21322a]">
                    Doctor Console
                  </Link>
                )
              )}
              {user.role === "admin" && (
                <Link href="/admin" className="text-sm font-medium text-[#42564f] hover:text-[#21322a]">
                  Admin Console
                </Link>
              )}

              <div className="flex items-center gap-2 border-l border-[#d7e2db] pl-4">
                <span className="text-sm font-semibold text-[#21322a]">{user.name}</span>
                <Badge variant={user.role === "admin" ? "urgent" : user.role === "doctor" ? "neutral" : "calm"}>
                  {user.status === "pending_approval" ? "PENDING" : user.role.toUpperCase()}
                </Badge>
                <Button variant="ghost" className="text-xs" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button variant="secondary" className="text-sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="text-sm">Create Account</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

