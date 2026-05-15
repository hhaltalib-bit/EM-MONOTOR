import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "-apple-system", "sans-serif"],
        mono: ["monospace"],
      },
      colors: {
        bg: "var(--bg)",
        bg2: "var(--bg2)",
        bg3: "var(--bg3)",
        bg4: "var(--bg4)",
        bdv: "var(--bdv)",
        bd2: "var(--bd2)",
        txv: "var(--txv)",
        tx2: "var(--tx2)",
        tx3: "var(--tx3)",
        gv: "var(--Gv)",
        gd: "var(--Gd)",
        gl: "var(--Gl)",
        cr: "var(--cr)",
        crb: "var(--crb)",
        wa: "var(--wa)",
        wab: "var(--wab)",
        hl: "var(--hl)",
        hlb: "var(--hlb)",
        bl: "var(--bl)",
        blb: "var(--blb)",
      },
      animation: {
        fillBar: "fillBar 0.9s ease-out forwards",
        dash: "dash 1.2s 0.4s ease-out forwards",
        blink: "blink 1.5s infinite",
        slideUp: "slideUp 0.3s ease-out both",
        popIn: "popIn 0.3s ease-out both",
        pgFade: "pgFade 0.2s",
        spin: "spin 0.8s linear infinite",
        shimmer: "shimmer 1.4s infinite",
      },
      keyframes: {
        fillBar: {
          from: { width: "0" },
          to: { width: "var(--w)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        popIn: {
          from: { opacity: "0", transform: "scale(0.93)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        pgFade: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "-400px 0" },
          to: { backgroundPosition: "400px 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
