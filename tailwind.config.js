/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0905",
        panel: "#151109",
        line: "#2A2520",
        cream: "#EDE8DF",
        muted: "#9C9384",
        clay: "#D97757",
        fire: "#C1502E",
        earth: "#6B7A5E",
        air: "#8E9AAF",
        water: "#5C7A99",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
