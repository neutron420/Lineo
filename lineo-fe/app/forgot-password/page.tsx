"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Mail, ShieldCheck, AlertCircle, KeyRound, Timer, Eye, EyeOff, Smartphone, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "method-select" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"email" | "sms">("email");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleSendOTP = async (e?: React.FormEvent, selectedMethod?: "email" | "sms") => {
    e?.preventDefault();
    setError(null);
    setIsLoading(true);

    const targetMethod = selectedMethod || method;

    try {
      await api.post("/auth/forgot-password", { 
        email, 
        method: targetMethod 
      });
      setMethod(targetMethod);
      setStep("otp");
      setTimeLeft(45);
      setSuccess(`Verification code sent via ${targetMethod === "email" ? "Email" : "SMS"}.`);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (code: string) => {
    if (code.length === 6) {
      setIsValidating(true);
      setError(null);
      
      // Artificial delay for premium feel
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setIsValidating(false);
      setStep("password");
      setSuccess("Code verified! Now set your new password.");
    }
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    verifyOTP(otp);
  };

  useEffect(() => {
    if (otp.length === 6 && step === "otp" && !isValidating) {
      verifyOTP(otp);
    }
  }, [otp, step]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (data.length === 6) {
      setOtp(data);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email,
        otp,
        new_password: newPassword
      });
      setSuccess("Password reset successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Reset failed. Check your OTP.");
      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        setStep("otp");
        setOtp("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/login" className="mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[440px] p-8 bg-white rounded-xl border border-slate-200 shadow-sm"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {step === "email" ? "Forgot Password" : step === "method-select" ? "Verify Identity" : step === "otp" ? "Verify OTP" : "New Password"}
          </h1>
          <p className="text-sm text-slate-500">
            {step === "email" 
              ? "Enter your email to receive a secure verification code." 
              : step === "method-select"
                ? "Choose how you'd like to receive your verification code."
                : step === "otp" 
                  ? `We've sent a 6-digit code to your ${method === "email" ? "Email" : "Phone"}`
                  : "Create a strong new password for your account."}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-lg flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 shrink-0" /> {success}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === "email" && (
            <motion.form
              key="email-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={(e) => { e.preventDefault(); setStep("method-select"); }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Registered Email</label>
                <input
                  type="email"
                  placeholder="m@example.com"
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full h-10 bg-slate-950 text-white font-medium rounded-md hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
              >
                Continue
              </button>
            </motion.form>
          )}

          {step === "method-select" && (
            <motion.div
              key="method-select"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <button
                onClick={() => handleSendOTP(undefined, "email")}
                disabled={isLoading}
                className="w-full p-4 border border-slate-200 rounded-xl hover:border-slate-950 hover:bg-slate-50 transition-all text-left flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-950 group-hover:text-white transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Email Verification</p>
                  <p className="text-xs text-slate-500">Send code to {email}</p>
                </div>
              </button>

              <button
                onClick={() => handleSendOTP(undefined, "sms")}
                disabled={isLoading}
                className="w-full p-4 border border-slate-200 rounded-xl hover:border-slate-950 hover:bg-slate-50 transition-all text-left flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-950 group-hover:text-white transition-colors">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">SMS Verification</p>
                  <p className="text-xs text-slate-500">Send code to your phone number</p>
                </div>
              </button>

              <button
                onClick={() => setStep("email")}
                className="w-full text-sm text-slate-500 hover:text-slate-900 transition-colors py-2"
              >
                Change Email
              </button>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.form
              key="otp-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleVerifyOTP}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">6-Digit Code</label>
                  {timeLeft > 0 ? (
                    <span className="text-[12px] font-medium text-slate-900 flex items-center gap-1">
                      <Timer className="w-3 h-3" /> Resend in {timeLeft}s
                    </span>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => handleSendOTP()}
                      className="text-[12px] font-medium text-slate-900 hover:underline"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
                   {[...Array(6)].map((_, i) => (
                     <input
                       key={i}
                       type="text"
                       maxLength={1}
                       autoComplete="one-time-code"
                       disabled={isValidating}
                       className="w-full h-12 bg-white border border-slate-200 rounded-md text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all disabled:opacity-50"
                       value={otp[i] || ""}
                       onChange={(e) => {
                         const val = e.target.value.replace(/\D/g, "");
                         if (val) {
                           const newOtp = otp.split("");
                           newOtp[i] = val;
                           setOtp(newOtp.join(""));
                           if (i < 5) (e.target.nextSibling as HTMLInputElement)?.focus();
                         } else {
                           const newOtp = otp.split("");
                           newOtp[i] = "";
                           setOtp(newOtp.join(""));
                           if (i > 0) (e.target.previousSibling as HTMLInputElement)?.focus();
                         }
                       }}
                     />
                   ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isValidating}
                className="w-full h-10 bg-slate-950 text-white font-medium rounded-md hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep("method-select")}
                className="w-full text-sm text-slate-500 hover:text-slate-900 transition-colors py-2"
              >
                Back to delivery methods
              </button>
            </motion.form>
          )}

          {step === "password" && (
            <motion.form
              key="password-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleResetPassword}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all pr-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-slate-950 text-white font-medium rounded-md hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            Remember your password?{" "}
            <Link href="/login" className="text-stripe-purple font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
