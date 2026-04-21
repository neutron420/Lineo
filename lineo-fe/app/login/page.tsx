"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in and redirect to their respective dashboard
    const adminUser = sessionStorage.getItem("admin_user");
    const staffUser = sessionStorage.getItem("staff_user");
    const user = sessionStorage.getItem("user");

    if (adminUser) {
      router.replace("/admin");
    } else if (staffUser) {
      router.replace("/org");
    } else if (user) {
      router.replace("/dashboard");
    } else {
      // Default to user login
      router.replace("/user/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stripe-border/10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-stripe-purple" />
        <p className="text-stripe-slate font-medium">Redirecting to secure portal...</p>
      </div>
    </div>
  );
}
