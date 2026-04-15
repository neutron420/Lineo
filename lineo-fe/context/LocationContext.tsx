'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface LocationContextType {
  coords: { lat: number; lng: number };
  address: string;
  pincode: string;
  refreshLocation: () => Promise<void>;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [coords, setCoords] = useState({ lat: 28.6139, lng: 77.2090 }); // Default Delhi
  const [address, setAddress] = useState("Detecting Location...");
  const [pincode, setPincode] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.replace('#', '');
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const parts = data.results[0].address_components;
        const neighborhood = parts.find((p: { types: string[] }) => p.types.includes("sublocality"))?.long_name || 
                           parts.find((p: { types: string[] }) => p.types.includes("locality"))?.long_name || "Main City";
        const pin = parts.find((p: { types: string[] }) => p.types.includes("postal_code"))?.long_name || "";
        
        setAddress(neighborhood);
        setPincode(pin);
        return { neighborhood, pin };
      }
    } catch (err) {
      console.error("Geocoding failed", err);
    }
    return { neighborhood: "Main City", pin: "" };
  }, []);

  const handlePositionChanges = useCallback(async (pos: GeolocationPosition) => {
    const { latitude, longitude } = pos.coords;
    setCoords({ lat: latitude, lng: longitude });
    await reverseGeocode(latitude, longitude);
    setIsLoading(false);
  }, [reverseGeocode]);

  const refreshLocation = async () => {
    if (!navigator.geolocation) return;
    toast.loading("Refining positioning...", { id: "global-gps" });
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await handlePositionChanges(pos);
      toast.success("Location Synchronized", { id: "global-gps" });
    }, () => {
      toast.error("GPS Signal Failed", { id: "global-gps" });
    });
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      // High-accuracy watcher for real-time app movement
      const watchId = navigator.geolocation.watchPosition(
        handlePositionChanges,
        (err) => console.error("WatchPosition Error:", err),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
      
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [handlePositionChanges]);

  return (
    <LocationContext.Provider value={{ coords, address, pincode, refreshLocation, isLoading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within LocationProvider");
  return context;
};
