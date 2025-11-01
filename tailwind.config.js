/** @type {import('tailwindcss').Config} */
module.exports = {
    // Add paths to all of your template files in your content array
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
      "./pages/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
      // Or if using `src` directory:
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {},
    },
  
    /**
     * THIS IS THE FIX:
     * This 'future' block tells Tailwind to opt-in to future defaults,
     * which, counter-intuitively, reverts to using RGB colors instead
     * of 'oklch' and 'lab'. This makes it compatible with html2canvas.
     */
    future: {
      defaultTheme: true,
    },
  
    plugins: [],
  };