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
        // Finance OS design system (colorblind-safe — see CLAUDE.md / gemini.md)
        brand: {
          bg: "#0b0f17",
          income: "#3b82f6", // blue-500
          expense: "#f97316", // orange-500
          warning: "#f59e0b", // amber-500
          neutral: "#6b7280", // gray-500
          success: "#10b981", // emerald-500
        },
      },
    },
  },
  plugins: [],
};
export default config;
