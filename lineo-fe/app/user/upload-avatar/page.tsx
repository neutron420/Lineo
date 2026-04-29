"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, ArrowRight, Loader2, Check, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function UploadAvatarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!email) {
      router.push("/user/login");
    }
  }, [email, router]);

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      toast.error("Camera access denied. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL("image/jpeg");
      setImage(dataUrl);
      
      // Convert to file
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const f = new File([blob], "avatar.jpg", { type: "image/jpeg" });
          setFile(f);
        });
      
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(f);
    }
  };

  const handleUpload = async () => {
    if (!file || !email) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const avatarUrl = uploadRes.data.data.url;
      
      // We need a way to update profile without being logged in yet, 
      // or we just pass the avatar in the registration originally.
      // Since we already registered, we'll use a public 'update-by-email' endpoint 
      // or just expect the user to login first.
      // But the user wants a separate page. Let's assume there's a backend endpoint for this.
      // I'll add a specialized endpoint for this in the backend.
      
      await api.put("/auth/update-avatar-public", {
        email,
        avatar_url: avatarUrl
      });
      
      toast.success("Profile picture uploaded!");
      router.push("/user/login?registered=true");
    } catch (err: any) {
      toast.error("Failed to upload. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7fafd] flex flex-col items-center justify-center p-4 selection:bg-[#493ee5]/10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[32px] p-8 md:p-10 shadow-2xl shadow-black/5 border border-[#e5e8eb]"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#493ee5]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <User className="w-8 h-8 text-[#493ee5]" />
          </div>
          <h1 className="text-2xl font-black text-[#181c1e] tracking-tight mb-2">Profile Picture</h1>
          <p className="text-sm text-[#49607e] font-medium">Add a photo so people recognize you</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="w-40 h-40 rounded-full border-4 border-[#f1f4f7] overflow-hidden bg-[#f1f4f7] flex items-center justify-center shadow-inner transition-all group-hover:border-[#493ee5]/20">
              {image ? (
                <img src={image} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-20 h-20 text-[#49607e]/30" />
              )}
            </div>
            
            <AnimatePresence>
              {image && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  onClick={() => { setImage(null); setFile(null); }}
                  className="absolute top-1 right-1 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={3} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {!image && !isCameraOpen && (
            <div className="grid grid-cols-2 gap-3 w-full">
               <button 
                onClick={startCamera}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-[#f1f4f7] hover:border-[#493ee5]/30 hover:bg-[#493ee5]/5 transition-all group"
               >
                 <div className="w-10 h-10 rounded-xl bg-[#f1f4f7] group-hover:bg-white flex items-center justify-center text-[#49607e] group-hover:text-[#493ee5] transition-colors">
                   <Camera className="w-5 h-5" />
                 </div>
                 <span className="text-xs font-bold text-[#49607e]">Camera</span>
               </button>

               <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-[#f1f4f7] hover:border-[#493ee5]/30 hover:bg-[#493ee5]/5 transition-all group cursor-pointer">
                 <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*" />
                 <div className="w-10 h-10 rounded-xl bg-[#f1f4f7] group-hover:bg-white flex items-center justify-center text-[#49607e] group-hover:text-[#493ee5] transition-colors">
                   <Upload className="w-5 h-5" />
                 </div>
                 <span className="text-xs font-bold text-[#49607e]">Upload</span>
               </label>
            </div>
          )}

          {isCameraOpen && (
            <div className="w-full space-y-4">
               <div className="aspect-square bg-black rounded-2xl overflow-hidden relative border-2 border-[#493ee5]">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover -scale-x-100" />
               </div>
               <div className="flex gap-2">
                 <Button onClick={takePhoto} className="flex-1 kinetic-btn-primary h-12 rounded-xl">
                   Capture Photo
                 </Button>
                 <Button variant="ghost" onClick={stopCamera} className="w-12 h-12 p-0 rounded-xl bg-[#f1f4f7]">
                   <X className="w-5 h-5" />
                 </Button>
               </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {image && !isCameraOpen && (
            <Button 
              onClick={handleUpload}
              disabled={isLoading}
              className="w-full h-12 kinetic-btn-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Set as Profile Picture</>}
            </Button>
          )}

          <button 
            onClick={() => router.push("/user/login?registered=true")}
            className="text-sm font-bold text-[#49607e] hover:text-[#493ee5] transition-colors flex items-center gap-1 group"
          >
            Skip for now <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
