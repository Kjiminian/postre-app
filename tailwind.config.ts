import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta K_Sweet — Crema & Rosa Ciruela Artesanal (Anti-Slop Capa 1)
        cream: {
          50: "#FDFCFB",
          100: "#FAF8F6",
          200: "#F3EDE8",
          300: "#E9DED7",
          400: "#D9C8BE",
          500: "#C5AFA3",
        },
        plum: {
          50: "#FCF2F6",
          100: "#F8E4ED",
          200: "#F0C8DA",
          300: "#E4A1C1",
          400: "#C9699A",
          500: "#9C4266",  // Rosa ciruela principal
          600: "#831843",  // Ciruela profunda
          700: "#6B1337",
          800: "#4D0D27",
          900: "#2E0717",
        },
        ink: {
          DEFAULT: "#302B32",
          light: "#554D57",
          muted: "#7A7079",
        },
        sage: {
          500: "#3B7865",  // Verde éxito / positivo
          600: "#2E6052",
        },
        amber: {
          400: "#F59E0B",
          500: "#D97706",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
      },
      boxShadow: {
        card: "0 1px 4px 0 rgba(48, 43, 50, 0.08)",
        "card-hover": "0 4px 16px 0 rgba(48, 43, 50, 0.12)",
        sidebar: "2px 0 12px 0 rgba(48, 43, 50, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
