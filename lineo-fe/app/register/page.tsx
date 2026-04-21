"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/user/register");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stripe-border/10">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-stripe-purple" />
        <p className="text-stripe-slate font-medium">Redirecting to registration portal...</p>
      </div>
    </div>
  );
}
