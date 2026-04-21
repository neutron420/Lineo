"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterOrgRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/org/register");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7fafd]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#493ee5]" />
        <p className="text-[#49607e] font-medium">Redirecting to institutional registration...</p>
      </div>
    </div>
  );
}
