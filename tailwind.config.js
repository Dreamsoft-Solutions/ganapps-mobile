/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        lynx: {
          primary: '#006e2a',
          'primary-container': '#00c853',
          'on-primary': '#ffffff',
          'on-primary-container': '#004c1b',
          'inverse-primary': '#3ce36a',

          secondary: '#5e5e5e',
          'secondary-container': '#e2e2e2',
          'on-secondary': '#ffffff',
          'on-secondary-container': '#646464',

          tertiary: '#9d4139',
          'tertiary-container': '#ff8d81',
          'on-tertiary': '#ffffff',
          'on-tertiary-container': '#76251f',

          error: '#ba1a1a',
          'error-container': '#ffdad6',
          'on-error': '#ffffff',
          'on-error-container': '#93000a',

          background: '#f9f9f9',
          'on-background': '#1a1c1c',

          surface: '#f9f9f9',
          'surface-dim': '#dadada',
          'surface-bright': '#f9f9f9',
          'surface-container-lowest': '#ffffff',
          'surface-container-low': '#f3f3f3',
          'surface-container': '#eeeeee',
          'surface-container-high': '#e8e8e8',
          'surface-container-highest': '#e2e2e2',
          'surface-tint': '#006e2a',
          'surface-variant': '#e2e2e2',
          'on-surface': '#1a1c1c',
          'on-surface-variant': '#3c4a3c',

          'inverse-surface': '#2f3131',
          'inverse-on-surface': '#f1f1f1',

          outline: '#6c7b6a',
          'outline-variant': '#bbcbb8',

          'primary-fixed': '#69ff87',
          'primary-fixed-dim': '#3ce36a',
          'on-primary-fixed': '#002108',
          'on-primary-fixed-variant': '#00531e',

          'secondary-fixed': '#e2e2e2',
          'secondary-fixed-dim': '#c6c6c6',
          'on-secondary-fixed': '#1b1b1b',
          'on-secondary-fixed-variant': '#474747',

          'tertiary-fixed': '#ffdad6',
          'tertiary-fixed-dim': '#ffb4ab',
          'on-tertiary-fixed': '#410002',
          'on-tertiary-fixed-variant': '#7e2a24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '700', letterSpacing: '-0.02em' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'headline-sm': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.05em' }],
        'label-sm': ['11px', { lineHeight: '14px', fontWeight: '500' }],
      },
      spacing: {
        base: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        'margin-mobile': '16px',
        'gutter-mobile': '12px',
      },
      borderRadius: {
        sm: '4px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
