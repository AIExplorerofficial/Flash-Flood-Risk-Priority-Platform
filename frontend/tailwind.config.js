/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#2563EB',
        p1: '#DC2626',
        p2: '#EA580C',
        p3: '#D97706',
        p4: '#64748B',
        r1: '#94A3B8',
        r2: '#78716C',
        r3: '#059669',
        r4: '#D97706',
        r5: '#B91C1C',
      },
    },
  },
  plugins: [],
}
