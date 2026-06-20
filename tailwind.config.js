/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E263C",
          dark: "#151B2C",
          light: "#EAEFF5",
          medium: "#9DA8BE",
        },
        accent: {
          DEFAULT: "#F8C400",
        },
        muted: {
          DEFAULT: "#BDC6D1",
          foreground: "#6B7280",
        },
        background: "#F5F7FA",
        card: "#FFFFFF",
        foreground: "#1E263C",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "2rem",
      },
      boxShadow: {
        card: "0 8px 16px rgba(30, 38, 60, 0.08)",
        soft: "0 6px 16px rgba(0,0,0,0.06)",
        floating: "0 18px 35px rgba(0,0,0,0.18)",
      },
      fontSize: {
        "title-lg": ["1.6rem", { fontWeight: "700" }],
        "card-label": ["0.85rem", { letterSpacing: "0.02em" }],
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
