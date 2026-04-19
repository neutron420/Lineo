"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  MapPin,
  ShieldCheck,
  FileCheck,
  ExternalLink,
  Phone,
  User,
  Image as ImageIcon,
  Compass,
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import api from "@/lib/api";
import { toast, Toaster } from "sonner";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID, getGoogleMapsApiKey } from "@/lib/maps-config";
import Link from "next/link";

interface VerificationItem {
  id: string;
  name: string;
  owner_name: string;
  owner_phone: string;
  address: string | null;
  pincode: string;
  state: string;
  createdAt: string;
  isVerified: boolean;
  status: "PENDING" | "FULLY_VERIFIED" | "REJECTED";
  office_img: string;
  cert_pdf: string;
  ptax_pdf: string;
  lat: number;
  lng: number;
}

export default function AuditProtocolPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeOrg, setActiveOrg] = useState<VerificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries: GOOGLE_MAPS_LIBRARIES as any
  });

  const fetchProtocol = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/verifications");
      const list = (res.data?.data || []) as VerificationItem[];
      const found = list.find(i => String(i.id) === id);
      
      if (found) {
        // If location is unresolved (0,0), attempt spatial reconstruction
        if (found.lat === 0 && found.lng === 0 && (found.address || found.pincode) && isLoaded) {
          const geocoder = new google.maps.Geocoder();
          // Sanitize the address string for better Geocoding hits
          const cleanAddress = (found.address || "").replace(/[|]/g, ',');
          const searchQuery = `${cleanAddress}, ${found.pincode}, ${found.state || ''}`.trim();

          geocoder.geocode({ address: searchQuery }, (results, status) => {
            if (status === "OK" && results && results[0]) {
               const { lat, lng } = results[0].geometry.location;
               setActiveOrg({ ...found, lat: lat(), lng: lng() });
               toast.success("Primary spatial resolution successful.");
               setLoading(false);
            } else {
               // Fallback: Geocode using ONLY Pincode if search failed
               console.warn("Primary geocoding failed, attempting Pincode-only vector...");
               geocoder.geocode({ address: found.pincode }, (pinResults, pinStatus) => {
                  if (pinStatus === "OK" && pinResults && pinResults[0]) {
                     const { lat, lng } = pinResults[0].geometry.location;
                     setActiveOrg({ ...found, lat: lat(), lng: lng() });
                     toast.info("Secondary Pincode resolution successful.");
                  } else {
                     setActiveOrg(found);
                     toast.error("Spatial link failed: Manual mapping required.");
                  }
                  setLoading(false);
               });
            }
          });
        } else {
          setActiveOrg(found);
          setLoading(false);
        }
      } else {
        toast.error("Vector target not found.");
        setLoading(false);
      }
    } catch (err) {
      toast.error("Audit pipe connection failed.");
      setLoading(false);
    }
  }, [id, isLoaded]);

  useEffect(() => {
    if (isLoaded) fetchProtocol();
  }, [fetchProtocol, isLoaded]);

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.put(`/admin/verifications/${id}/status`, { status: newStatus });
      toast.success(`Protocol Successful: Status moved to ${newStatus}`);
      router.push("/admin/verifications");
    } catch (err) {
      toast.error("Protocol Failed.");
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
         <div className="flex flex-col items-center gap-6">
            <div className="relative">
               <Loader2 className="w-16 h-16 animate-spin text-[#493ee5]" />
               <div className="absolute inset-0 blur-2xl bg-[#493ee5]/15 animate-pulse rounded-full" />
            </div>
            <div className="text-center space-y-2">
               <p className="text-[11px] font-black text-[#181c1e] uppercase tracking-[0.5em]">Calibrating Audit Vectors</p>
               <p className="text-[9px] font-bold text-[#49607e] uppercase tracking-widest opacity-60">Synchronizing Institutional Telemetry...</p>
            </div>
         </div>
      </div>
    );
  }

  if (!activeOrg) return null;

  return (
    <div className="flex h-screen bg-[#f7fafd] overflow-hidden">
      <Toaster position="top-right" richColors />
      
      {/* Left Control Column (Light/Blue Theme) */}
      <div className="w-[480px] flex-shrink-0 border-r border-[#e5e8eb] flex flex-col h-full bg-white shadow-2xl z-20">
         {/* Navigation & Header */}
         <div className="p-10 border-b border-[#e5e8eb] bg-[#f7fafd]">
            <Link 
               href="/admin/verifications"
               className="inline-flex items-center gap-3 text-[10px] font-black text-[#49607e] hover:text-[#493ee5] transition-all group tracking-widest mb-8"
            >
               <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
               VECTORS / AUDIT PIPELINE
            </Link>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#493ee5] mb-3 block">Sector Identity / {id}</span>
            <h1 className="text-4xl font-black tracking-tightest leading-none text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
               {activeOrg.name}
            </h1>
         </div>

         {/* Audit Body */}
         <div className="p-10 space-y-12 overflow-y-auto">
            <section className="space-y-8">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#49607e]">Credential Matrix</h3>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    activeOrg.status === 'PENDING' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-[#493ee5]/10 border-[#493ee5]/20 text-[#493ee5]'
                  }`}>
                     {activeOrg.status}
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-8">
                  <InfoRow label="Institutional Address" value={activeOrg.address || "Unresolved Mapping"} icon={MapPin} />
                  <InfoRow label="Protocol Admin" value={activeOrg.owner_name} icon={User} />
                  <InfoRow label="Postal Index" value={activeOrg.pincode} icon={ShieldCheck} />
                  <InfoRow label="Communication Link" value={activeOrg.owner_phone} icon={Phone} />
               </div>
            </section>

            <section className="space-y-8">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#49607e]">Auditable Evidence</h3>
               <div className="space-y-4">
                  <AssetCard label="Office Storefront" url={activeOrg.office_img} icon={ImageIcon} />
                  <AssetCard label="Registration Cert" url={activeOrg.cert_pdf} icon={FileCheck} />
                  <AssetCard label="Tax Documents" url={activeOrg.ptax_pdf} icon={ShieldCheck} />
               </div>
            </section>

            <section className="space-y-8 pt-12 border-t border-[#e5e8eb]">
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#49607e]">Terminal Execution</h3>
               <div className="grid grid-cols-2 gap-5">
                  <button 
                     disabled={updating}
                     onClick={() => handleUpdateStatus('FULLY_VERIFIED')}
                     className="bg-[#493ee5] hover:bg-[#3b31ba] text-white font-black text-[11px] py-5 rounded-2xl uppercase tracking-[0.2em] transition-all shadow-xl shadow-[#493ee5]/20 active:scale-95 disabled:opacity-50"
                  >
                     Approve
                  </button>
                  <button 
                     disabled={updating}
                     onClick={() => handleUpdateStatus('REJECTED')}
                     className="bg-white border border-[#e5e8eb] text-red-600 hover:bg-red-50 font-black text-[11px] py-5 rounded-2xl uppercase tracking-[0.2em] transition-all active:scale-95 disabled:opacity-50"
                  >
                     Quarantine
                  </button>
               </div>
            </section>
         </div>
      </div>

      {/* Right Spatial Viewport (Full Map) */}
      <div className="flex-1 relative bg-slate-100">
         <div className="absolute top-10 left-10 z-10 space-y-4">
            <div className="px-6 py-4 bg-white border border-[#e5e8eb] rounded-2xl flex items-center gap-6 shadow-2xl">
               <div className="w-10 h-10 rounded-xl bg-[#493ee5]/10 flex items-center justify-center">
                  <Compass className="w-5 h-5 text-[#493ee5]" />
               </div>
               <div className="flex gap-6">
                  <div className="flex flex-col">
                     <span className="text-[8px] font-black text-[#49607e] uppercase tracking-widest mb-1">Longitude</span>
                     <span className="text-[12px] font-black text-[#181c1e] tracking-widest uppercase">{(activeOrg.lng || 0).toFixed(6)}</span>
                  </div>
                  <div className="w-px h-8 bg-[#e5e8eb]" />
                  <div className="flex flex-col">
                     <span className="text-[8px] font-black text-[#49607e] uppercase tracking-widest mb-1">Latitude</span>
                     <span className="text-[12px] font-black text-[#181c1e] tracking-widest uppercase">{(activeOrg.lat || 0).toFixed(6)}</span>
                  </div>
               </div>
            </div>
            
            {activeOrg.lat === 0 && (
               <div className="px-6 py-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 shadow-2xl animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Caution: Spatial Resolution Failed</span>
               </div>
            )}
         </div>

         {isLoaded ? (
            <GoogleMap
               mapContainerStyle={{ width: '100%', height: '100%' }}
               center={{ lat: activeOrg.lat || 0, lng: activeOrg.lng || 0 }}
               zoom={16}
               options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                  mapId: "f0e9e987c6720d3f" // Required for Advanced Markers
               }}
               onLoad={(map) => {
                  // Advanced Marker Implementation
                  const markerPosition = { lat: activeOrg.lat || 0, lng: activeOrg.lng || 0 };
                  
                  try {
                     // Using the new AdvancedMarkerElement
                     const pinElement = new google.maps.marker.PinElement({
                        background: "#493ee5",
                        borderColor: "#ffffff",
                        glyphColor: "#ffffff",
                        scale: 1.2
                     });

                     new google.maps.marker.AdvancedMarkerElement({
                        map: map,
                        position: markerPosition,
                        title: activeOrg.name,
                        content: pinElement.element,
                     });
                  } catch (e) {
                     console.error("Advanced Marker Load Failed, using legacy fallback logic.");
                  }
               }}
            />
         ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#f7fafd]">
               <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#493ee5]" />
                  <p className="text-[10px] font-black text-[#49607e] uppercase tracking-widest">Linking Satellite Link...</p>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: any) {
   return (
      <div className="flex items-start gap-6 group">
         <div className="w-12 h-12 rounded-2xl bg-[#493ee5]/5 flex items-center justify-center text-[#493ee5] border border-[#493ee5]/10 shrink-0 group-hover:bg-[#493ee5] group-hover:text-white transition-all">
            <Icon className="w-5 h-5" />
         </div>
         <div className="flex flex-col">
            <span className="text-[9px] font-black text-[#49607e] uppercase tracking-[0.2em] mb-1.5">{label}</span>
            <span className="text-[14px] font-bold text-[#181c1e] leading-snug">{value}</span>
         </div>
      </div>
   );
}

function AssetCard({ label, url, icon: Icon }: any) {
   return (
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer" 
        className="flex items-center justify-between p-6 bg-[#f7fafd] border border-[#e5e8eb] rounded-[24px] hover:border-[#493ee5]/40 hover:bg-white group transition-all shadow-sm hover:shadow-md"
      >
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-white rounded-2xl border border-[#e5e8eb] flex items-center justify-center text-[#49607e] group-hover:text-[#493ee5] transition-colors">
               <Icon className="w-5 h-5" />
            </div>
            <div>
               <p className="text-[10px] font-black text-[#181c1e] uppercase tracking-[0.2em]">{label}</p>
               <p className="text-[9px] text-emerald-600 font-bold uppercase mt-1 tracking-widest">Protocol Verified</p>
            </div>
         </div>
         <ExternalLink className="w-4 h-4 text-[#49607e] group-hover:text-[#493ee5] transition-all" />
      </a>
   );
}

