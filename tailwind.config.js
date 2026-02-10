/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#06b6d4", hover: "#0891b2" },
        secondary: "#64748b",
        success: "#22c55e",
        error: "#ef4444",
        text: "#1e293b",
        border: "#e2e8f0",
      },
    },
  },
  plugins: [],
};
