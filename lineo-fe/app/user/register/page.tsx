"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, User, Mail, Lock, Phone, Calendar } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import api from "@/lib/api";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

export default function UserRegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [hasDisability, setHasDisability] = useState(false);
  const [disabilityType, setDisabilityType] = useState("");
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
        phone,
        dob,
        gender,
        has_disability: hasDisability,
        disability_type: disabilityType,
        role: "user",
        turnstile_token: captchaToken
      });

      router.push("/user/login?registered=true");
    } catch (err) {
      const axiosError = err as AxiosError<{ message: string }>;
      setError(axiosError.response?.data?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/user/login" className="mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[500px] p-10 bg-white"
      >
        <div className="mb-10 text-center">
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Join Lineo</h1>
          <p className="text-[15px] text-stripe-slate">Create your personal account to join queues.</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                 <User className="w-3.5 h-3.5" /> Full Name
               </label>
               <input 
                 type="text" 
                 placeholder="John Doe" 
                 className="stripe-input" 
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 required 
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                 <Mail className="w-3.5 h-3.5" /> Email
               </label>
               <input 
                 type="email" 
                 placeholder="john@example.com" 
                 className="stripe-input" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                 <Phone className="w-3.5 h-3.5" /> Phone Number
               </label>
               <input 
                 type="tel" 
                 placeholder="+91 98765 43210" 
                 className="stripe-input" 
                 value={phone}
                 onChange={(e) => setPhone(e.target.value)}
                 required 
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                 <Calendar className="w-3.5 h-3.5" /> Date of Birth
               </label>
               <input 
                 type="date" 
                 className="stripe-input" 
                 value={dob}
                 onChange={(e) => setDob(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium text-stripe-label">Identity Vector (Gender)</label>
             <select 
               className="stripe-input appearance-none bg-white"
               value={gender}
               onChange={(e) => setGender(e.target.value)}
               required
             >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
             </select>
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

          <div className="space-y-4 pt-2 border-t border-stripe-border mt-4">
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                   <p className="text-sm font-bold text-stripe-navy">Accessibility Support</p>
                   <p className="text-[11px] text-stripe-slate">Do you have any physical disability?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                   <input 
                     type="checkbox" 
                     className="sr-only peer" 
                     checked={hasDisability}
                     onChange={(e) => setHasDisability(e.target.checked)}
                   />
                   <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stripe-purple"></div>
                </label>
             </div>

             <motion.div
               initial={false}
               animate={{ height: hasDisability ? 'auto' : 0, opacity: hasDisability ? 1 : 0 }}
               className="overflow-hidden space-y-2"
             >
                <label className="text-sm font-medium text-stripe-label flex items-center gap-2">
                   Specific care requirement?
                </label>
                <select 
                  className="stripe-input appearance-none bg-white font-medium"
                  value={disabilityType}
                  onChange={(e) => setDisabilityType(e.target.value)}
                >
                   <option value="">Select Disability Type</option>
                   <option value="mobility">Mobility Impairment</option>
                   <option value="visual">Visual Impairment</option>
                   <option value="hearing">Hearing Impairment</option>
                   <option value="cognitive">Cognitive / Learning</option>
                   <option value="other">Other Preference</option>
                </select>
             </motion.div>
          </div>

          <div className="py-2">
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
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign Up"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stripe-border text-center">
          <p className="text-sm text-stripe-slate">
            Already have an account?{" "}
            <Link href="/user/login" className="text-stripe-purple font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
