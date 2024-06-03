const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  darkMode: "class",
  content: [
    "./public/*.html",
    "./app/helpers/**/*.rb",
    "./app/javascript/**/*.js",
    "./app/views/**/*.{erb,haml,html,slim}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
      ringColor: {
        DEFAULT: "#3ABAB4",
      },
      colors: {
        customGreen: "#3ABAB4",
        customBlue: "#667EEA",
        customPink: "#EC4899",
        primary: {
          DEFAULT: "#3ABAB4",
          dark: "#2A8D88",
          hover: "#35A09E",
          "dark-hover": "#20746F",
        },
        secondary: {
          light: "#f472b6",
          dark: "#f472b6",
        },
        accent: {
          light: "#fb923c",
          dark: "#fb923c",
        },
        neutral: {
          light: "#9ca3af",
          dark: "#9ca3af",
        },
        base: {
          light: "#ffffff",
          dark: "#1d1d1d",
        },
        info: {
          light: "#3b82f6",
          dark: "#3b82f6",
        },
        success: {
          light: "#10b981",
          dark: "#10b981",
        },
        warning: {
          light: "#fbbf24",
          dark: "#fbbf24",
        },
        error: {
          light: "#ef4444",
          dark: "#ef4444",
        },
        gray: {
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#454545",
          900: "#3d3d3d",
          950: "#1d1d1d",
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/aspect-ratio"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
  ],
};
