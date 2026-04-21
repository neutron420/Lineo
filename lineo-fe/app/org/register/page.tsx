"use client";

import React, { Suspense, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Loader2, 
  Building2, 
  MapPin, 
  FileText, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  Upload, 
  ShieldCheck, 
  Globe, 
  Hash, 
  Users,
  Search,
  Activity,
  Eye
} from "lucide-react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID, getGoogleMapsApiKey } from "@/lib/maps-config";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { Turnstile } from "@marsidev/react-turnstile";

const steps = [
  { id: 1, name: "Location", icon: MapPin },
  { id: 2, name: "Account", icon: User },
  { id: 3, name: "Organization", icon: Building2 },
  { id: 4, name: "Verification", icon: ShieldCheck },
];

function OrgRegisterContent() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const router = useRouter();
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries: GOOGLE_MAPS_LIBRARIES as any
  });

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    orgName: "",
    orgType: "hospital",
    ownerName: "",
    ownerPhone: "",
    address: "",
    pincode: "",
    state: "",
    lat: 0,
    lng: 0,
    officeImageURL: "",
    certPdfURL: "",
    ptaxPaperURL: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [nearbyOrgs, setNearbyOrgs] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleOrgSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        
        let pincode = "";
        let state = "";
        result.address_components.forEach((c: any) => {
          if (c.types.includes("postal_code")) pincode = c.long_name;
          if (c.types.includes("administrative_area_level_1")) state = c.long_name;
        });

        updateFormData({ 
          lat, 
          lng, 
          address: result.formatted_address,
          pincode,
          state,
          orgName: searchQuery
		});

        // Discovery
        const nearbyResp = await api.get(`/search/nearby?lat=${lat}&lng=${lng}&radius=5000`);
        const detected = nearbyResp.data.data || [];
        
        setNearbyOrgs(detected.slice(0, 5));
        toast.success("Institutional boundaries localized.");
      }
    } catch (err) {
      toast.error("Discovery protocol failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    
    // Trigger auto-fetch if pincode is 6 characters
    if (data.pincode && data.pincode.length === 6) {
      handlePincodeSearch(data.pincode);
    }
  };

  const handlePincodeSearch = async (code: string) => {
    setIsSearching(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${code}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        
        let state = "";
        result.address_components.forEach((c: any) => {
          if (c.types.includes("administrative_area_level_1")) state = c.long_name;
        });

        updateFormData({ 
          lat, 
          lng, 
          address: result.formatted_address,
          state: state
        });

        // Search our DB for nearby orgs
        const nearbyResp = await api.get(`/search/nearby?lat=${lat}&lng=${lng}&radius=5000`);
        const detected = nearbyResp.data.data || [];
        setNearbyOrgs(detected.slice(0, 5));
        toast.success("Spatial coordinates refined.");
      }
    } catch (err) {
      console.error("Pincode search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectOrg = (org: any) => {
    updateFormData({
      orgName: org.name,
      address: org.address || formData.address,
      orgType: org.type || formData.orgType,
    });
    setSearchQuery(org.name);
    toast.success(`${org.name} details synchronized.`);
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleAutoFetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    toast.info("Synchronizing satellite coordinates...");
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      updateFormData({ lat: latitude, lng: longitude });

      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
        // 1. Get Address, Pincode, State
        const geoResponse = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
        );
        const geoData = await geoResponse.json();

        if (geoData.status === "OK" && geoData.results.length > 0) {
          const result = geoData.results[0];
          const addressComponents = result.address_components;
          let pincode = "";
          let state = "";
          addressComponents.forEach((component: any) => {
            if (component.types.includes("postal_code")) pincode = component.long_name;
            if (component.types.includes("administrative_area_level_1")) state = component.long_name;
          });

          updateFormData({ address: result.formatted_address, pincode, state });
        }

        // 2. Fetch Nearby Orgs from our API
        const nearbyResp = await api.get(`/search/nearby?lat=${latitude}&lng=${longitude}&radius=5000`);
        const detected = nearbyResp.data.data || [];
        setNearbyOrgs(detected.slice(0, 5));
        toast.success("Location and local ecosystem synchronized.");
      } catch (error) {
        console.error("Discovery error:", error);
      }
    }, (error) => {
      toast.error("Spatial sensors access denied.");
    });
  };


  const handleSubmit = async () => {
    if (!captchaToken) {
      toast.error("Please complete the security check.");
      return;
    }

    if (!formData.username || !formData.email || !formData.password || !formData.orgName) {
      toast.error("Account details and Organization name are mandatory.");
      return;
    }

    if (!formData.officeImageURL || !formData.certPdfURL || !formData.ptaxPaperURL) {
      toast.error("Please upload all mandatory compliance documents in Step 4.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/register-org", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        org_name: formData.orgName,
        org_type: formData.orgType,
        address: formData.address,
        pincode: formData.pincode,
        state: formData.state,
        lat: formData.lat,
        lng: formData.lng,
        owner_name: formData.ownerName,
        owner_phone: formData.ownerPhone,
        office_image_url: formData.officeImageURL,
        cert_pdf_url: formData.certPdfURL,
        ptax_paper_url: formData.ptaxPaperURL,
        turnstile_token: captchaToken
      });

      toast.success("Registration Successful!", {
        description: "Your organization is now pending verification."
      });
      router.push("/org/login?pending=true");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed. Please check your details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fafd] flex flex-col items-center justify-center p-8 selection:bg-[#493ee5]/10 selection:text-[#493ee5]">
      <Toaster position="top-right" richColors />
      <div className="w-full max-w-[850px]">
        <Link href="/org/login" className="mb-8 text-[#49607e] hover:text-[#181c1e] transition-colors flex items-center gap-2 group font-bold text-sm">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Login
        </Link>

        {/* Progress Stepper */}
        <div className="bg-white rounded-3xl p-6 mb-8 border border-[#e5e8eb] shadow-sm">
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[#f1f4f7] -translate-y-1/2" />
            <motion.div 
              className="absolute top-1/2 left-0 h-0.5 bg-[#493ee5] -translate-y-1/2" 
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border-2",
                    currentStep >= step.id ? "bg-[#493ee5] border-[#493ee5] text-white shadow-lg" : "bg-white border-[#e5e8eb] text-[#49607e]"
                  )}>
                    {currentStep > step.id ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={cn(
                    "text-[10px] uppercase tracking-widest font-black mt-2",
                    currentStep >= step.id ? "text-[#493ee5]" : "text-[#49607e]/40"
                  )}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-[32px] p-10 border border-[#e5e8eb] shadow-xl min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-10 flex-1 py-4"
              >
                <div className="flex items-start justify-between">
                   <div>
                      <h2 className="text-3xl font-black text-[#181c1e] tracking-tight">Institutional Target</h2>
                      <p className="text-[#49607e] text-lg font-medium mt-1">Acquire physical coordinates for your organization.</p>
                   </div>
                   <button 
                     type="button"
                     onClick={handleAutoFetchLocation}
                     className="w-14 h-14 bg-[#493ee5] text-white rounded-2xl shadow-2xl hover:rotate-12 transition-all flex items-center justify-center group"
                   >
                     <Globe className="w-6 h-6 group-hover:scale-110 transition-transform" />
                   </button>
                </div>

                <div className="space-y-8">
                   {/* Search Bar */}
                   <div className="relative group">
                      <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                         <Search className="w-5 h-5 text-[#49607e] group-focus-within:text-[#493ee5] transition-colors" />
                      </div>
                      <input 
                        type="text"
                        placeholder="Search for your institution by name (e.g. City Apollo Hospital)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleOrgSearch()}
                        className="w-full pl-16 pr-24 py-6 bg-[#f7fafd] border border-[#e5e8eb] rounded-[24px] outline-none focus:bg-white focus:border-[#493ee5] focus:ring-8 focus:ring-[#493ee5]/5 transition-all font-bold text-[#181c1e] text-lg shadow-sm"
                      />
                      <button 
                        type="button"
                        onClick={handleOrgSearch}
                        disabled={isSearching}
                        className="absolute right-3 top-3 bottom-3 px-6 bg-[#181c1e] text-white rounded-[18px] text-xs font-black uppercase tracking-widest hover:bg-[#493ee5] transition-all flex items-center justify-center min-w-[100px]"
                      >
                         {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                         <div className="grid grid-cols-2 gap-4">
                            <InputField 
                              label="Area Pincode" 
                              placeholder="141001" 
                              icon={Hash} 
                              value={formData.pincode} 
                              onChange={(v:any) => updateFormData({ pincode: v })} 
                            />
                            <InputField 
                              label="State" 
                              placeholder="Punjab" 
                              icon={Globe} 
                              value={formData.state} 
                              onChange={(v:any) => updateFormData({ state: v })} 
                            />
                         </div>
                         <InputField 
                           label="Full Physical Domain" 
                           placeholder="Full verified address..." 
                           icon={MapPin} 
                           value={formData.address} 
                           onChange={(v:any) => updateFormData({ address: v })} 
                         />
                      </div>

                      <div className="space-y-6">
                         <div className="bg-white rounded-[32px] p-2 border border-[#e5e8eb] shadow-2xl h-full flex flex-col relative overflow-hidden group">
                            {isLoaded ? (
                              <div className="w-full h-[300px] rounded-[28px] overflow-hidden relative">
                                <GoogleMap
                                  mapContainerStyle={{ width: '100%', height: '100%' }}
                                  center={{ lat: formData.lat || 30.9010, lng: formData.lng || 75.8573 }}
                                  zoom={15}
                                  options={{
                                    disableDefaultUI: true,
                                  }}
                                >
                                  <Marker 
                                    position={{ lat: formData.lat, lng: formData.lng }}
                                  />
                                </GoogleMap>
                              </div>
                            ) : (
                              <div className="w-full h-[300px] bg-slate-50 animate-pulse rounded-[28px] flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-[#493ee5] animate-spin" />
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                   <h2 className="text-2xl font-black text-[#181c1e] tracking-tight">Identity Setup</h2>
                   <p className="text-[#49607e] text-sm font-medium mt-1">Establish administrative access protocols.</p>
                </div>
                
                <div className="space-y-4">
                   <InputField label="Admin Username" placeholder="e.g. city_hospital_admin" icon={User} value={formData.username} onChange={(v :any)=> updateFormData({ username: v })} />
                   <InputField label="Contact Email" type="email" placeholder="admin@organization.com" icon={Mail} value={formData.email} onChange={(v :any)=> updateFormData({ email: v })} />
                   <InputField label="Secure Password" type="password" placeholder="••••••••" icon={Lock} value={formData.password} onChange={(v :any)=> updateFormData({ password: v })} />
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                   <h2 className="text-2xl font-black text-[#181c1e] tracking-tight">Organization Profile</h2>
                   <p className="text-[#49607e] text-sm font-medium mt-1">Configure your institutional identity.</p>
                </div>

                <div className="space-y-4">
                   <InputField label="Organization Name" placeholder="e.g. City Hospital" icon={Building2} value={formData.orgName} onChange={(v:any) => updateFormData({ orgName: v })} />
                   <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-[#49607e] block">Institution Type</label>
                      <select 
                        className="w-full px-5 py-4 bg-[#f7fafd] border border-[#e5e8eb] rounded-2xl outline-none focus:bg-white focus:border-[#493ee5] transition-all font-bold text-[#181c1e] text-sm"
                        value={formData.orgType}
                        onChange={(e) => updateFormData({ orgType: e.target.value })}
                      >
                        <option value="hospital">Healthcare / Hospital</option>
                        <option value="bank">Financial / Bank</option>
                        <option value="government">Government Office</option>
                        <option value="retail">Retail Hub</option>
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <InputField label="Chief Officer" placeholder="John Doe" icon={User} value={formData.ownerName} onChange={(v:any) => updateFormData({ ownerName: v })} />
                      <InputField label="Emergency Contact" placeholder="+91 99999 99999" icon={Phone} value={formData.ownerPhone} onChange={(v:any) => updateFormData({ ownerPhone: v })} />
                   </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 flex-1"
              >
                <div>
                   <h2 className="text-2xl font-black text-[#181c1e] tracking-tight">System Compliance</h2>
                   <p className="text-[#49607e] text-sm font-medium mt-1">Submit mandatory documents for platform verification.</p>
                </div>

                <div className="space-y-3">
                   <UploadBox 
                     label="Institution Image (Front Office)" 
                     icon={Building2} 
                     value={formData.officeImageURL} 
                     onUpload={(url: string) => updateFormData({ officeImageURL: url })}
                   />
                   <UploadBox 
                     label="Registration Certificate (PDF)" 
                     icon={FileText} 
                     value={formData.certPdfURL} 
                     onUpload={(url: string) => updateFormData({ certPdfURL: url })}
                   />
                   <UploadBox 
                     label="Tax Documents / PTax (PDF)" 
                     icon={ShieldCheck} 
                     value={formData.ptaxPaperURL} 
                     onUpload={(url: string) => updateFormData({ ptaxPaperURL: url })}
                   />
                </div>

                <div className="py-2 flex justify-center">
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                    onSuccess={(token) => setCaptchaToken(token)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="mt-10 pt-8 border-t border-[#e5e8eb] flex items-center justify-between">
            <button 
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || isLoading}
              className="flex items-center gap-2 text-sm font-bold text-[#49607e] disabled:opacity-30"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
            
            {currentStep < steps.length ? (
              <button 
                type="button"
                onClick={nextStep}
                className="bg-[#493ee5] text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg hover:shadow-[#493ee5]/20 transition-all flex items-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-[#181c1e] text-white px-10 py-3 rounded-2xl font-bold text-sm shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit for Verification"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrgRegisterPage() {
  return (
    <Suspense fallback={
       <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#493ee5]" />
       </div>
    }>
      <OrgRegisterContent />
    </Suspense>
  );
}

function InputField({ label, type = "text", placeholder, icon: Icon, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black uppercase tracking-widest text-[#49607e] flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      <input 
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-5 py-4 bg-[#f7fafd] border border-[#e5e8eb] rounded-2xl outline-none focus:bg-white focus:border-[#493ee5] transition-all font-bold text-[#181c1e] text-sm"
      />
    </div>
  );
}

function UploadBox({ label, icon: Icon, value, onUpload }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      onUpload(resp.data.data.url);
      toast.success("Document archived.");
    } catch (err) {
      toast.error("Cloud archival failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-[#f7fafd] border border-[#e5e8eb] rounded-2xl group hover:border-[#493ee5]/30 transition-all">
       <input 
         type="file" 
         className="hidden" 
         ref={fileInputRef} 
         onChange={handleFileChange} 
         accept="image/*,application/pdf"
       />
       <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white rounded-xl border border-[#e5e8eb] text-[#49607e] group-hover:text-[#493ee5] transition-colors relative">
             <Icon className="w-5 h-5" />
             {value && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white">
                   <Check className="w-2.5 h-2.5 text-white" />
                </div>
             )}
          </div>
          <div className="flex flex-col">
             <p className="text-xs font-bold text-[#181c1e]">{label}</p>
             <p className="text-[10px] text-[#49607e] font-medium break-all max-w-[200px]">
               {value ? (
                 <span className="text-emerald-600 font-bold">Synchronized to Cloud</span>
               ) : (
                 "Action Required"
               )}
             </p>
          </div>
       </div>

       <div className="flex items-center gap-2">
          {value && (
             <button 
               type="button"
               onClick={() => window.open(value, "_blank")}
               className="p-2 bg-white rounded-lg border border-[#e5e8eb] text-[#49607e] hover:bg-slate-100 hover:text-[#181c1e] transition-all"
               title="Preview Document"
             >
                <Eye className="w-4 h-4" />
             </button>
          )}
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`p-2 rounded-lg border border-[#e5e8eb] transition-all flex items-center justify-center min-w-[36px] min-h-[36px] ${
              value 
                ? "bg-emerald-500 text-white border-emerald-500" 
                : "bg-white text-[#49607e] hover:bg-[#493ee5] hover:text-white"
            } disabled:opacity-50`}
          >
             {isUploading ? (
               <Loader2 className="w-4 h-4 animate-spin" />
             ) : value ? (
               <Check className="w-4 h-4" />
             ) : (
               <Upload className="w-4 h-4" />
             )}
          </button>
       </div>
    </div>
  );
}
