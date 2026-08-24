/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#FAF6EE",
        forest: "#2F4A3D",
        forestDark: "#1D2F27",
        turmeric: "#D98E3B",
        turmericDark: "#B06F26",
        ink: "#2B2A26"
      },
      fontFamily: {
        display: ["'Sukhumvit Set'", "'Noto Sans Thai'", "system-ui", "sans-serif"],
        body: ["'Noto Sans Thai'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
