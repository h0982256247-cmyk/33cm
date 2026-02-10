/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6", // blue-500
        secondary: "#64748b", // slate-500
        success: "#10b981", // green-500
        error: "#ef4444", // red-500
        warning: "#f59e0b", // amber-500
        text: "#1e293b", // slate-800
        border: "#e2e8f0", // slate-200
      },
    },
  },
  plugins: [],
};
