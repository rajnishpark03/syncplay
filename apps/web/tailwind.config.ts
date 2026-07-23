import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Warm, romantic dark plum/wine base for a "couple" mood.
        base: {
          950: '#0f0710',
          900: '#170a16',
          850: '#1e0f1c',
          800: '#251324',
          700: '#341a30',
          600: '#48273f',
        },
        // Rose/pink primary accent.
        accent: {
          DEFAULT: '#ff5c8a',
          soft: '#ff86a9',
          muted: '#c24069',
        },
        // Secondary warm accent (rose-gold) for gradients/highlights.
        gold: {
          DEFAULT: '#ffb37a',
        },
        // Kept for "online" semantics — a soft warm green still reads as online.
        mint: {
          DEFAULT: '#4ee6a8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(255, 92, 138, 0.5)',
        card: '0 8px 30px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '80%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite',
        wave: 'wave 1s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
