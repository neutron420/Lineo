"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, ShieldAlert, AlertCircle } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

export default function SystemAdminLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
       setError("Please complete the security turnstile verification.");
       return;
    }

    setIsLoading(true);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
        turnstile_token: captchaToken
      });

      const { data } = response.data;
      if (data.user.role !== "admin") {
         setError(`Access Denied: Insufficient Clearance. (Detected Role: ${data.user.role})`);
         setIsLoading(false);
         return;
      }

      sessionStorage.setItem("admin_token", data.token);
      sessionStorage.setItem("admin_user", JSON.stringify(data.user));

      router.push("/admin");
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-4 md:p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/" className="mb-8 md:mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group text-sm font-medium">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Return to Public Portal
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[420px] p-6 md:p-10 bg-white"
      >
        <div className="mb-10">
          <div className="w-12 h-12 bg-stripe-purple/10 rounded-xl flex items-center justify-center mb-6 border border-stripe-purple/20 shadow-sm">
            <ShieldAlert className="w-6 h-6 text-stripe-purple" />
          </div>
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Lineo Root Access</h1>
          <p className="text-[15px] text-stripe-slate">System Administrator Gateway.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-stripe flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Root Email
            </label>
            <input
              type="email"
              placeholder="admin@lineo.ai"
              className="stripe-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
             <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Root Sequence
                </label>
             </div>
            <input
              type="password"
              placeholder="••••••••••••••••"
              className="stripe-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3 mt-4"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Authenticate Identity"}
          </button>

          <div className="flex justify-center mt-6">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
              options={{ theme: "light" }}
            />
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            New administrator?{" "}
            <Link href="/admin/register" className="text-stripe-purple font-medium hover:underline">
              Initialize root profile
            </Link>
          </p>
        </div>
      </motion.div>
      <footer className="mt-10 flex items-center gap-6 text-xs text-stripe-slate/60 font-light">
        <span>&copy; Lineo.sys Central Command 2026</span>
      </footer>
    </div>
  );
}
