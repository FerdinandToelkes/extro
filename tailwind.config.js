/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F5F6F1",
        ink: "#21242B",
        inksoft: "#5B6169",
        indigo: "#4B4ECF",
        coral: "#FF7A59",
        sand: "#E8A33D",
        sage: "#7FA687",
        border: "#E2E0D8",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
