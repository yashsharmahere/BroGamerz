/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#12121a',
          card: '#1a1a25',
          hover: '#22223a',
        },
        border: {
          DEFAULT: '#252535',
          bright: '#353550',
        },
        accent: {
          blue: '#4f9cf9',
          'blue-dim': '#1e3a5f',
          green: '#22c55e',
          'green-dim': '#14532d',
          orange: '#f59e0b',
          'orange-dim': '#78350f',
          red: '#ef4444',
          'red-dim': '#7f1d1d',
          purple: '#a855f7',
        },
        text: {
          primary: '#f1f5f9',
          secondary: '#8892a4',
          muted: '#4a5568',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 5px #4f9cf940' },
          to: { boxShadow: '0 0 20px #4f9cf980, 0 0 40px #4f9cf840' },
        }
      }
    },
  },
  plugins: [],
}
