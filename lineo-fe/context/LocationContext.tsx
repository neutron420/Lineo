'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface LocationContextType {
  coords: { lat: number; lng: number };
  address: string;
  pincode: string;
  city: string;
  setCity: (city: string) => void;
  refreshLocation: () => Promise<void>;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [coords, setCoords] = useState({ lat: 28.6139, lng: 77.2090 }); // Default Delhi
  const [address, setAddress] = useState("Detecting Location...");
  const [pincode, setPincode] = useState("");
  const [city, setCityState] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Persistence for city
  const setCity = useCallback((newCity: string) => {
    setCityState(newCity);
    localStorage.setItem('selected_city', newCity);
  }, []);

  useEffect(() => {
    const savedCity = localStorage.getItem('selected_city');
    if (savedCity) setCityState(savedCity);
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      // Use our backend proxy to avoid CORS issues and API key leakage
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/search/address?lat=${lat}&lng=${lng}`);
      
      if (!response.ok) throw new Error(`Protocol Error: ${response.status}`);
      
      const data = await response.json();
      if (data.data?.address) {
        const fullAddress = data.data.address;
        // Simple heuristic to extract a neighborhood-like name from formatted address
        const parts = fullAddress.split(',');
        const neighborhood = parts.length > 1 ? parts[parts.length - 3] || parts[0] : parts[0];
        const pin = fullAddress.match(/\b\d{6}\b/)?.[0] || ""; // Match Indian pincode format (6 digits)
        
        setAddress(neighborhood.trim());
        setPincode(pin);

        // Try to extract city specifically
        const cityPart = parts.length > 2 ? parts[parts.length - 3] : parts[0];
        if (cityPart) setCity(cityPart.trim());

        return { neighborhood: neighborhood.trim(), pin };
      }
    } catch (err) {
      console.error("Geocoding failed:", err instanceof Error ? err.message : "Network Interrupted");
      setAddress("Main City");
    }
    return { neighborhood: "Main City", pin: "" };
  }, [setCity]);

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
    // Check cache first to prevent "blinking" on page reload
    const cachedCoords = sessionStorage.getItem('user_coords');
    const cachedAddress = sessionStorage.getItem('user_address');
    const cachedPin = sessionStorage.getItem('user_pincode');

    if (cachedCoords && cachedAddress) {
      setCoords(JSON.parse(cachedCoords));
      setAddress(cachedAddress);
      setPincode(cachedPin || "");
      setIsLoading(false);
      return;
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        handlePositionChanges,
        (err) => {
          console.error("Initial GPS Fetch Error:", err);
          setIsLoading(false);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 } // 5 min cache
      );
    } else {
      setIsLoading(false);
    }
  }, [handlePositionChanges]);

  // Update cache when position changes
  useEffect(() => {
    if (!isLoading && address !== "Detecting Location...") {
      sessionStorage.setItem('user_coords', JSON.stringify(coords));
      sessionStorage.setItem('user_address', address);
      sessionStorage.setItem('user_pincode', pincode);
    }
  }, [coords, address, pincode, isLoading]);

  return (
    <LocationContext.Provider value={{ coords, address, pincode, city, setCity, refreshLocation, isLoading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within LocationProvider");
  return context;
};
