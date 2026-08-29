/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#FBF3E3",
        forest: "#E8792F",
        forestDark: "#B85A1F",
        turmeric: "#F2B705",
        turmericDark: "#C98F02",
        ink: "#3A2A18"
      },
      fontFamily: {
        display: ["'Sukhumvit Set'", "'Noto Sans Thai'", "system-ui", "sans-serif"],
        body: ["'Noto Sans Thai'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
