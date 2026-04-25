"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, Lock, ShieldCheck, AlertCircle, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { initPushNotifications } from "@/lib/push";
import { useRouter, useSearchParams } from "next/navigation";
import { AxiosError } from "axios";

interface AuthResponse {
  data: {
    token: string;
    user: {
      role: string;
      username: string;
      organization_id?: number | null;
    };
  };
}

function UserLoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isRegistered = searchParams.get("registered") === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError("Please complete the security check.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
        turnstile_token: captchaToken
      });

      const { data } = response.data;
      const user = data.user;
      
      if (user.role === "user") {
        sessionStorage.setItem("token", data.token);
        sessionStorage.setItem("user", JSON.stringify(user));
        // Register push notifications in the background
        initPushNotifications().catch(() => {});
        router.push("/dashboard");
      } else {
        setError("Access Denied: Please use the appropriate portal for your role.");
      }
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-4 md:p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/" className="mb-8 md:mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group text-sm font-medium">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Home
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[400px] p-6 md:p-10 bg-white"
      >
        <div className="mb-10">
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Welcome back</h1>
          <p className="text-[15px] text-stripe-slate">Sign in to your account to continue</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-stripe flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {isRegistered && !error && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-stripe flex items-start gap-3">
             <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
             <div>
                <p className="font-bold">Success</p>
                <p className="text-[13px] opacity-80 mt-1">
                  Registration complete. You can now sign in.
                </p>
             </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Email address
            </label>
            <input
              type="email"
              placeholder="m@example.com"
              className="stripe-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" /> Password
              </label>
              <Link href="/forgot-password"  className="text-sm font-medium text-stripe-purple hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="stripe-input pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stripe-slate hover:text-stripe-navy transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="py-2 flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </button>

          <button
            type="button"
            className="w-full py-3 bg-white text-stripe-navy border border-stripe-border rounded-stripe font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            Continue with Google
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            New to Lineo?{" "}
            <Link href="/user/register" className="text-stripe-purple font-medium hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function UserLoginPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-stripe-purple" />
       </div>
    }>
      <UserLoginContent />
    </Suspense>
  );
}
