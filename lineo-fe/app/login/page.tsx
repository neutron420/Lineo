"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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
      setError("Please complete the security check.");
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
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("user", JSON.stringify(data.user));

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin/dashboard");
      } else if (data.user.role === "agent") {
        router.push("/agent/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/" className="mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to QueueLess
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[420px] p-10 bg-white"
      >
        <div className="mb-10">
          <div className="w-12 h-12 bg-stripe-purple/10 rounded-xl flex items-center justify-center mb-6">
            <Lock className="w-6 h-6 text-stripe-purple" />
          </div>
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Sign in</h1>
          <p className="text-[15px] text-stripe-slate">Access your queue management dashboard.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Email address
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              className="stripe-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Password
              </label>
              <Link href="/forgot-password" title="Forgot Password" className="text-sm text-stripe-purple hover:underline">
                Forgot?
              </Link>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="stripe-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="py-2">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => setError("Captcha failed to load")}
              onExpire={() => setCaptchaToken(null)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in to your account"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            Don't have an account?{" "}
            <Link href="/register" className="text-stripe-purple font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Footer Links */}
      <footer className="mt-10 flex items-center gap-6 text-xs text-stripe-slate/60 font-light">
        <span>&copy; QueueLess 2026</span>
        <Link href="/privacy" className="hover:text-stripe-navy transition-colors">Privacy</Link>
        <Link href="/terms" className="hover:text-stripe-navy transition-colors">Terms</Link>
      </footer>
    </div>
  );
}
