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
        'stripe-sm': '0 2px 5px rgba(50,50,93,0.1), 0 1px 1px rgba(0,0,0,0.07)',
        'stripe-md': 'rgba(50,50,93,0.11) 0px 4px 6px, rgba(0,0,0,0.08) 0px 1px 3px',
        'stripe-lg': 'rgba(50,50,93,0.25) 0px 50px 100px -20px, rgba(0,0,0,0.3) 0px 30px 60px -30px',
        'stripe-premium': 'rgba(50,50,93,0.25) 0px 30px 45px -30px, rgba(0,0,0,0.1) 0px 18px 36px -18px',
      },
      borderRadius: {
        'stripe': '4px',
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
