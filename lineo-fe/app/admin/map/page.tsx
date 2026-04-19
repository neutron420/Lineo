"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Map as MapIcon,
  RefreshCw,
  XCircle,
  Building2,
  Users,
  MapPin,
  Layers,
  X,
  Eye,
  EyeOff,
  Search,
  Activity
} from "lucide-react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID, getGoogleMapsApiKey } from "@/lib/maps-config";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Dummy data for Lineo map
const orgPins = [
  { id: "1", name: "Apollo Main Hosp.", lat: 28.6139, lng: 77.2090, status: "Active Q: 42" },
  { id: "2", name: "HDFC Bank Branch", lat: 19.0760, lng: 72.8777, status: "Active Q: 12" },
  { id: "3", name: "Visa Office Center", lat: 12.9716, lng: 77.5946, status: "Active Q: 89" },
];

const containerStyle = {
  width: '100%',
  height: '100%'
};
// Center of India
const center = {
  lat: 20.5937,
  lng: 78.9629
};

interface MapPinItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
}

export default function GlobalMapPage() {
  const [loading, setLoading] = useState(false);
  const [mapZoom, setMapZoom] = useState(4.5);
  const [mapCenter, setMapCenter] = useState(center);
  
  const [showOrgs, setShowOrgs] = useState(true);
  const [selectedItem, setSelectedItem] = useState<MapPinItem | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: getGoogleMapsApiKey(),
    libraries: GOOGLE_MAPS_LIBRARIES as any
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  }, []);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'Enter') {
        const query = e.currentTarget.value.toLowerCase();
        if (query.includes('delhi')) setMapCenter({lat: 28.6139, lng: 77.2090});
        else if (query.includes('mumbai')) setMapCenter({lat: 19.0760, lng: 72.8777});
        else if (query.includes('bengaluru')) setMapCenter({lat: 12.9716, lng: 77.5946});
        setMapZoom(12);
     }
  };

  if (loadError) {
    return (
       <div className="flex items-center justify-center h-96">
        <div className="bg-white rounded-3xl shadow-ambient p-8 max-w-md text-center space-y-4 border border-transparent ghost-border w-full aspect-video flex flex-col items-center justify-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Maps Engine Error</h2>
          <p className="text-[#49607e] font-medium text-sm">Failed to load Google Maps. Ensure NEXT_PUBLIC_GOOGLE_MAPS_KEY is active in .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-[#181c1e] tracking-tight" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Global Deployment Map</h1>
          <p className="text-[#49607e] text-sm font-medium mt-1">Live visualization of affiliated organizations and traffic.</p>
        </div>
        <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2 bg-white ghost-border rounded-lg text-[#181c1e] hover:bg-[#f7fafd] shadow-sm font-bold text-sm transition-all">
          <RefreshCw className={cn("h-4 w-4 text-[#493ee5]", loading && "animate-spin")} /> Refresh Grid
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-transparent shadow-ambient p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#493ee5]/10">
              <Building2 className="h-5 w-5 text-[#493ee5]" />
            </div>
            <div>
              {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>1104</p>}
              <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mt-0.5">Active Orgs</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border border-transparent shadow-ambient p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50">
              <Activity className="h-5 w-5 text-green-600" />
            </div>
            <div>
              {loading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>8.4K</p>}
              <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mt-0.5">Live Queues</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-transparent shadow-ambient p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50">
              <MapPin className="h-5 w-5 text-red-600" />
            </div>
            <div>
              {loading ? <Skeleton className="h-8 w-10 mb-1" /> : <p className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>14</p>}
              <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mt-0.5">Alerts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-transparent shadow-ambient p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-50">
              <Users className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              {loading ? <Skeleton className="h-8 w-20 mb-1" /> : <p className="text-2xl font-extrabold text-[#181c1e]" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>45K</p>}
              <p className="text-[10px] text-[#49607e] font-bold uppercase tracking-widest mt-0.5">Global Users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-white rounded-3xl border border-transparent shadow-ambient overflow-hidden flex-1 group min-h-[500px]">
         {!isLoaded ? (
            <div className="absolute inset-0 p-8 space-y-4">
               <Skeleton className="h-10 w-64 rounded-xl" />
               <Skeleton className="h-full w-full rounded-2xl" />
            </div>
         ) : (
            <>
               <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={mapCenter}
                  zoom={mapZoom}
                  options={{
                     disableDefaultUI: true,
                     zoomControl: true,
                  }}
               >
                  {showOrgs && orgPins.map(pin => (
                     <Marker 
                        key={pin.id} 
                        position={{ lat: pin.lat, lng: pin.lng }}
                        onClick={() => setSelectedItem(pin)}
                     />
                  ))}

                  {selectedItem && (
                     <InfoWindow
                        position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
                        onCloseClick={() => setSelectedItem(null)}
                     >
                        <div className="p-2 space-y-1 min-w-[120px]">
                           <p className="font-extrabold text-[#181c1e] text-sm">{selectedItem.name}</p>
                           <p className="text-xs text-[#493ee5] font-bold">{selectedItem.status}</p>
                        </div>
                     </InfoWindow>
                  )}
               </GoogleMap>

               {/* Overlay Control Panel */}
               <div className="absolute top-4 right-4 z-10 w-64 bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-white">
                  <div className="relative mb-4">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#49607e]" />
                     <input
                        type="text"
                        placeholder="Search locations..."
                        onKeyDown={handleSearch}
                        className="w-full pl-9 pr-3 py-2.5 text-sm font-medium bg-white border border-[#e5e8eb] rounded-xl focus:border-[#493ee5] focus:ring-1 focus:ring-[#493ee5]/20 outline-none transition-all"
                     />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                     <div className="bg-[#493ee5]/10 p-1.5 rounded-lg">
                        <Layers className="h-4 w-4 text-[#493ee5]" />
                     </div>
                     <p className="text-xs font-extrabold text-[#181c1e] uppercase tracking-widest" style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>Visual Layers</p>
                  </div>

                  <div className="space-y-2">
                     <div className="flex items-center justify-between p-2 rounded-xl bg-[#f7fafd] border border-transparent">
                        <div className="flex items-center gap-3">
                           <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
                           <span className="text-xs font-bold text-[#49607e]">Organizations</span>
                        </div>
                        <button onClick={() => setShowOrgs(!showOrgs)} className={showOrgs ? "text-[#493ee5]" : "text-[#49607e]"}>
                           {showOrgs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                     </div>
                  </div>
               </div>
            </>
         )}
      </div>
    </div>
  );
}
