import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // The Kinetic Pulse - M3 Inspired Palette
        primary: "#493ee5",
        "primary-container": "#635bff",
        "on-primary": "#ffffff",
        "on-primary-container": "#fefaff",
        "primary-fixed": "#e2dfff",
        "on-primary-fixed": "#0f0069",
        
        secondary: "#49607e",
        "secondary-container": "#c4dcff",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#49617f",
        "secondary-fixed": "#d2e4ff",
        "on-secondary-fixed": "#001c37",
        
        tertiary: "#525b6e",
        "tertiary-container": "#6a7487",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#fbfaff",
        
        surface: "#f7fafd",
        "on-surface": "#181c1e",
        "surface-bright": "#f7fafd",
        "surface-dim": "#d7dadd",
        "surface-variant": "#e0e3e6",
        "on-surface-variant": "#464555",
        
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f1f4f7",
        "surface-container": "#ebeef1",
        "surface-container-high": "#e5e8eb",
        "surface-container-highest": "#e0e3e6",
        
        outline: "#777587",
        "outline-variant": "#c7c4d8",
        
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        stripe: {
          purple: "#533afd",
          purpleHover: "#4434d4",
          navy: "#061b31",
          navyDark: "#0d253d",
          brandDark: "#1c1e54",
          slate: "#64748d",
          label: "#273951",
          border: "#e5edf5",
          ruby: "#ea2261",
          magenta: "#f96bee",
          green: "#15be53",
          greenDark: "#108c3d",
        },
      },
      boxShadow: {
        'neobrutal': '4px 4px 0px 0px #e2dfff',
        'neobrutal-lg': '6px 6px 0px 0px #e2dfff',
        'ambient': '0 40px 40px rgba(24, 28, 30, 0.04)',
        'stripe-sm': '0 2px 5px rgba(50,50,93,0.1), 0 1px 1px rgba(0,0,0,0.07)',
        'stripe-md': 'rgba(50,50,93,0.11) 0px 4px 6px, rgba(0,0,0,0.08) 0px 1px 3px',
        'stripe-lg': 'rgba(50,50,93,0.25) 0px 50px 100px -20px, rgba(0,0,0,0.3) 0px 30px 60px -30px',
        'stripe-premium': 'rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px',
      },
      borderRadius: {
        'stripe': '4px',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      fontFamily: {
        headline: ["var(--font-manrope)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      letterSpacing: {
        'stripe-hero': '-1.4px',
        'stripe-display': '-0.96px',
        'stripe-tight': '-0.64px',
      },
    },
  },
  plugins: [],
};
export default config;
