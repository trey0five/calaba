/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Section bgs — "Aurora Loop": opaque per-section fields.
        // Paper (light) fields carry aurora blooms at whisper opacity;
        // ink (dark) fields carry the full night-sky treatment.
        'bg-deep':   '#1C0E3E',   // ink-900 (Testimonials field)
        'ink-950':   '#140A2E',   // deepest night (ContactCta/Footer, Hero top)
        'ink-850':   '#241348',   // Hero bottom / CredentialsBand
        'bg-base':   '#FFFBF5',   // paper-0
        'bg-raised': '#FDF6EC',   // paper-1
        'paper-2':   '#F6F1FB',   // lavender mid-scroll beat (Process only)
        'bg-glow':   '#FBF0DA',
        surface:      '#FFFFFF',
        'surface-tint':'#FBF6EC',
        ink:          '#2A1452',
        'ink-muted':  '#6B5A8A',
        // Brand decorative (unchanged)
        'teal':       '#22C7C0',
        'teal-deep':  '#0E5A56',
        'teal-bright':'#2FE0D8',
        'gold':       '#F5B027',
        'gold-deep':  '#8A5F08',   // text-safe on paper (AA as body text)
        'gold-bright':'#FFC44D',
        'coral':      '#EE4B3C',
        'coral-bright':'#FF8A6E',
        'coral-deep': '#B8451F',   // text-safe on white
        'magenta':    '#D6337A',
        'magenta-bright':'#FF6FB0',
        'magenta-deep':'#9C1F5B',  // text-safe on white
        // Text tokens
        'text-base':  '#2A1452',   // body on light (flipped)
        'text-muted': '#6B5A8A',
        'text-light': '#F4EEFB',   // body on dark sections (Footer/Testimonials)
        'text-light-muted': '#B9A8D4',
        // Borders
        hair:         '#EDE6DC',  // warm neutral hairline (was lavender)
        'hair-dark':  '#3D2466',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px rgba(30,11,59,0.10)',
        cosmic: '0 14px 40px rgba(11,4,24,0.45)',
        'glow-gold': '0 0 24px rgba(245,176,39,0.5)',
        'glow-teal': '0 0 24px rgba(47,224,216,0.45)',
        'glow-magenta': '0 30px 80px -20px rgba(214,51,122,0.45)',
      },
    },
  },
  plugins: [],
};
