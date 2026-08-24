"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function RegisterRedirectPage() {
  useEffect(() => {
    redirect("/signup");
  }, []);

  return null;
}

