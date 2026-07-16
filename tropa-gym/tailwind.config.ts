import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '24px',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        // shadcn/ui semantic aliases (CSS variables, defined in src/index.css)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',

        // Tropa Gym — tokens exactos doc 08
        surface: '#0d160b',
        'surface-dim': '#0d160b',
        'surface-container-lowest': '#081006',
        'surface-container-low': '#151e12',
        'surface-container': '#192216',
        'surface-container-high': '#232c20',
        'surface-container-highest': '#2e372a',
        'surface-variant': '#2e372a',
        'surface-bright': '#333c2f',
        'on-surface': '#dbe6d3',
        'on-surface-variant': '#bbcbb2',
        outline: '#86957e',
        'outline-variant': '#3d4b37',

        'primary-fixed': '#77ff62',
        'primary-fixed-dim': '#40e432',
        'primary-container': '#08c609',
        'on-primary': '#003a00',
        'on-primary-container': '#004a00',
        'inverse-primary': '#006e01',

        'secondary-container': '#065308',
        'on-secondary-container': '#7ec670',
        'secondary-fixed': '#aaf599',

        tertiary: '#ffb1c7',
        'tertiary-container': '#ff83ac',

        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
      },
      fontFamily: {
        anton: ['Anton', 'sans-serif'],
        oswald: ['Oswald', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '4px',
        lg: '8px',
        xl: '12px',
        full: '9999px',
        card: '16px',
      },
      spacing: {
        gutter: '24px',
        'margin-desktop': '40px',
        'margin-mobile': '16px',
        unit: '4px',
      },
      maxWidth: {
        'container-max': '1440px',
      },
      boxShadow: {
        'premium-glow': '0 0 20px 2px rgba(16, 89, 15, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
