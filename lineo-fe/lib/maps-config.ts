export const GOOGLE_MAPS_LIBRARIES: ("marker" | "places" | "drawing" | "geometry" | "visualization")[] = ["marker"];
export const GOOGLE_MAPS_ID = 'google-map-script';

export const getGoogleMapsApiKey = () => (process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "").replace('#', '');
