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
  const [disabilityFile, setDisabilityFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+91");
  const router = useRouter();

  const countries = [
    { code: "+91", flag: "🇮🇳", name: "India" },
    { code: "+1", flag: "🇺🇸", name: "USA" },
    { code: "+44", flag: "🇬🇧", name: "UK" },
    { code: "+971", flag: "🇦🇪", name: "UAE" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaToken) {
      setError("Please complete the security check.");
      return;
    }

    if (hasDisability && !disabilityFile) {
      setError("Please upload a disability proof document.");
      return;
    }

    setIsLoading(true);
    let proofUrl = "";

    try {
      // 1. Upload file if exists
      if (hasDisability && disabilityFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", disabilityFile);
        const uploadRes = await api.post("/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        proofUrl = uploadRes.data.data.url;
        setIsUploading(false);
      }

      // 2. Register user
      await api.post("/auth/register", {
        username,
        email,
        password,
        phone: `${countryCode} ${phone}`,
        dob,
        gender,
        has_disability: hasDisability,
        disability_type: disabilityType,
        disability_proof_url: proofUrl,
        role: "user",
        turnstile_token: captchaToken
      });

      router.push(`/user/upload-avatar?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Registration failed. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stripe-border/10 flex flex-col items-center justify-center p-4 md:p-6 selection:bg-stripe-purple/20 selection:text-stripe-purple">
      <Link href="/user/login" className="mb-8 md:mb-10 text-stripe-slate hover:text-stripe-navy transition-colors flex items-center gap-2 group text-sm font-medium">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="stripe-card w-full max-w-[500px] p-6 md:p-10 bg-white"
      >
        <div className="mb-10">
          <h1 className="text-[26px] tracking-stripe-tight mb-2 text-stripe-navy font-semibold">Join Lineo</h1>
          <p className="text-[15px] text-stripe-slate">Create your account to start managing queues</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-stripe">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label">Full Name</label>
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
               <label className="text-sm font-medium text-stripe-label">Email</label>
               <input 
                 type="email" 
                 placeholder="m@example.com" 
                 className="stripe-input"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label">Phone Number</label>
                <div className="flex gap-2">
                  <div className="relative shrink-0">
                    <select 
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="stripe-input w-24 pl-3 pr-8 appearance-none bg-white font-bold"
                    >
                      {countries.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-stripe-slate">
                      <svg width="8" height="5" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <input 
                      type="tel" 
                      placeholder="00000 00000" 
                      className="stripe-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      required 
                    />
                  </div>
                </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label">Date of Birth</label>
               <input 
                 type="date" 
                 className="stripe-input"
                 value={dob}
                 onChange={(e) => setDob(e.target.value)}
                 required 
               />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
               <label className="text-sm font-medium text-stripe-label">Gender</label>
               <div className="relative">
                 <select 
                   className="stripe-input appearance-none"
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
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stripe-slate">
                   <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                     <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                   </svg>
                 </div>
               </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-stripe-label">Password</label>
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
          </div>

          <div className="space-y-4 pt-4 border-t border-stripe-border mt-4">
             <div className="flex items-center justify-between p-4 bg-stripe-border/10 rounded-stripe border border-stripe-border">
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
               className="overflow-hidden space-y-4"
             >
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stripe-label">
                    Specific care requirement?
                  </label>
                  <div className="relative">
                    <select 
                      className="stripe-input appearance-none"
                      value={disabilityType}
                      onChange={(e) => setDisabilityType(e.target.value)}
                      required={hasDisability}
                    >
                       <option value="">Select Disability Type</option>
                       <option value="mobility">Mobility Impairment</option>
                       <option value="visual">Visual Impairment</option>
                       <option value="hearing">Hearing Impairment</option>
                       <option value="cognitive">Cognitive / Learning</option>
                       <option value="other">Other Preference</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stripe-slate">
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stripe-label">
                    Upload Proof (ID/Certificate)
                  </label>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setDisabilityFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="disability-upload"
                      required={hasDisability}
                    />
                    <label 
                      htmlFor="disability-upload"
                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-stripe-border rounded-stripe cursor-pointer hover:border-stripe-purple transition-colors bg-white group"
                    >
                      <div className="text-center">
                        <p className="text-sm font-medium text-stripe-navy group-hover:text-stripe-purple transition-colors">
                          {disabilityFile ? disabilityFile.name : "Click to upload document"}
                        </p>
                        <p className="text-[10px] text-stripe-slate mt-1">PDF, JPG or PNG (Max 5MB)</p>
                      </div>
                    </label>
                  </div>
                </div>
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
            disabled={isLoading || isUploading}
            className="stripe-btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {isLoading || isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isUploading ? "Uploading proof..." : "Creating account..."}
              </>
            ) : "Create account"}
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
