"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Heart, Landmark, User, Mail, Lock } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("user");
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
      setError("Please complete the security check.");
      return;
    }

    setIsLoading(true);

    try {
      await api.post("/auth/register", {
        username,
        email,
        password,
        role: selectedRole,
        turnstile_token: captchaToken
      });

      // After registration, redirect to login
      router.push("/login?registered=true");
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Registration failed. Please try again.");
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
        className="stripe-card w-full max-w-[500px] p-10 bg-white"
      >
        <div className="mb-10 text-center">
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Get started.</h1>
          <p className="text-[15px] text-stripe-slate">Choose your account type to continue.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-3 gap-3 mb-8">
            <RoleCard 
              label="Standard" 
              active={selectedRole === 'user'} 
              icon={<User className="w-4 h-4" />}
              onClick={() => setSelectedRole('user')} 
            />
            <RoleCard 
              label="Agent" 
              active={selectedRole === 'agent'} 
              icon={<Heart className="w-4 h-4" />}
              onClick={() => setSelectedRole('agent')} 
            />
            <RoleCard 
              label="Admin" 
              active={selectedRole === 'admin'} 
              icon={<Landmark className="w-4 h-4" />}
              onClick={() => setSelectedRole('admin')} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Username
            </label>
            <input 
              type="text" 
              placeholder="johndoe" 
              className="stripe-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

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
            <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Password
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

          <div className="py-2">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
            />
          </div>

          <p className="text-[13px] text-stripe-slate/60 leading-snug">
            By clicking &ldquo;Create account&rdquo;, you agree to our Terms of Service and Privacy Policy. No credit card required.
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="stripe-btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create an account"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            Already have an account?{" "}
            <Link href="/login" className="text-stripe-purple font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function RoleCard({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 rounded-stripe border flex flex-col items-center gap-2 transition-all ${
        active 
          ? 'border-stripe-purple bg-stripe-purple/5 ring-1 ring-stripe-purple text-stripe-purple shadow-sm' 
          : 'border-stripe-border bg-white text-stripe-slate hover:border-stripe-slate/30'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
