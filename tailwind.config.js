module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          600: '#1E40AF'
        },
        surface: '#F8FAFC'
      },
      boxShadow: {
        'card': '0 6px 18px rgba(15,23,42,0.06)'
      }
    }
  },
  plugins: []
}