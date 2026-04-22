"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, User, Mail, Lock, Phone, Calendar, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
        className="w-full max-w-[500px] p-8 bg-white rounded-xl border border-slate-200 shadow-sm"
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create an account</h1>
          <p className="text-sm text-slate-500">Enter your details below to create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Full Name</label>
               <input 
                 type="text" 
                 placeholder="John Doe" 
                 className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all"
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 required 
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Email</label>
               <input 
                 type="email" 
                 placeholder="m@example.com" 
                 className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Phone Number</label>
               <input 
                 type="tel" 
                 placeholder="+91 98765 43210" 
                 className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all"
                 value={phone}
                 onChange={(e) => setPhone(e.target.value)}
                 required 
               />
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Date of Birth</label>
               <input 
                 type="date" 
                 className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all"
                 value={dob}
                 onChange={(e) => setDob(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Gender</label>
               <select 
                 className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all appearance-none"
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
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100 mt-4">
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-0.5">
                   <p className="text-sm font-bold text-slate-900">Accessibility Support</p>
                   <p className="text-[11px] text-slate-500">Do you have any physical disability?</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                   <input 
                     type="checkbox" 
                     className="sr-only peer" 
                     checked={hasDisability}
                     onChange={(e) => setHasDisability(e.target.checked)}
                   />
                   <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-950"></div>
                </label>
             </div>

             <motion.div
               initial={false}
               animate={{ height: hasDisability ? 'auto' : 0, opacity: hasDisability ? 1 : 0 }}
               className="overflow-hidden space-y-2"
             >
                <label className="text-sm font-medium text-slate-700">
                   Specific care requirement?
                </label>
                <select 
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 transition-all appearance-none"
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

          <div className="py-2 flex justify-center">
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
              onSuccess={(token) => setCaptchaToken(token)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-slate-950 text-white font-medium rounded-md hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/user/login" className="text-slate-900 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
