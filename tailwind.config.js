/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",   // harmless if you don't use /pages
    "./src/**/*.{js,ts,jsx,tsx,mdx}",     // in case you left files here
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
