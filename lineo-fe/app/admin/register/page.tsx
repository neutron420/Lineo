"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Landmark, User, Mail, Lock, ShieldAlert } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

export default function SystemAdminRegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
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
      await api.post("/auth/register", {
        username,
        email,
        password,
        role: "admin",
        turnstile_token: captchaToken
      });

      router.push("/admin/login?registered=true");
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/admin/login" className="mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group text-sm font-medium">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[500px] p-10 bg-white"
      >
        <div className="mb-10 text-center">
          <div className="w-12 h-12 bg-stripe-purple/10 rounded-xl flex items-center justify-center mx-auto mb-6 border border-stripe-purple/20 shadow-sm">
            <ShieldAlert className="w-6 h-6 text-stripe-purple" />
          </div>
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Initialize Root.</h1>
          <p className="text-[15px] text-stripe-slate">Create highly privileged administrator account.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Root Handle
            </label>
            <input 
              type="text" 
              placeholder="sysadmin" 
              className="stripe-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Secure Email
            </label>
            <input 
              type="email" 
              placeholder="root@lineo.ai" 
              className="stripe-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Root Sequence (Password)
            </label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="stripe-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <p className="text-[13px] text-stripe-slate/60 leading-snug">
            By creating a root account, you accept total responsibility for the Lineo.sys command center.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deploy Root Account"}
          </button>

          <div className="flex justify-center mt-6">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
              options={{ theme: "light" }}
            />
          </div>
        </form>
      </motion.div>
    </div>
  );
}
