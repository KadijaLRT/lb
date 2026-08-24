/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F6F2E9",
        panel: "#FFFFFF",
        line: "#E3DDCC",
        cream: "#2B2620",
        muted: "#8B8375",
        clay: "#C96A4B",
        fire: "#C1502E",
        earth: "#5F7052",
        air: "#5C7290",
        water: "#4F7086",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
