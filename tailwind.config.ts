import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      animation: {
        "fade-out": "fadeOut 1s ease-out 3s forwards",
        "pinggate-glow-bounce": "pinggate-glow-bounce 2s ease-in-out infinite",
      },
      keyframes: {
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "pinggate-glow-bounce": {
          "0%, 100%": {
            transform: "translateY(0) scale(1)",
            boxShadow: "0 0 0px #8565CB",
            opacity: "1",
          },
          "50%": {
            transform: "translateY(-4px) scale(1.05)",
            boxShadow: "0 0 10px #8565CB",
            opacity: "0.95",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;
