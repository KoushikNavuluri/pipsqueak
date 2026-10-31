// Pipsqueak's visual language: warm paper, deep ink, one vermilion "pip".
// Every color in the app comes from these tokens.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F4EE",
        canvas: "#EFECE4",
        surface: "#FFFFFF",
        sunken: "#EEEBE3",
        wash: "#F8F6F1",
        line: "#E4E0D6",
        "line-soft": "#ECE9E1",
        "line-strong": "#D2CCBF",
        ink: "#17150F",
        "ink-2": "#3B3830",
        mute: "#69655B",
        faint: "#9A9588",
        night: "#100F0C",
        accent: "#FF4D1A",
        "accent-deep": "#C8380C",
        "accent-soft": "#FFEBE2",
        success: "#1F8A5B",
        "success-deep": "#156B45",
        "success-soft": "#E5F4EC",
        danger: "#C2321F",
        "danger-line": "#F0CFC8",
        "danger-soft": "#FCEFEC",
        warn: "#A8640F",
        "warn-soft": "#FDF3E1",
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        hair: "0 0 0 1px rgba(23,21,15,.06)",
        soft: "0 1px 2px rgba(23,21,15,.05), 0 6px 20px -10px rgba(23,21,15,.14)",
        lift: "0 2px 6px rgba(23,21,15,.05), 0 22px 48px -20px rgba(23,21,15,.28)",
        pop: "0 28px 80px -24px rgba(23,21,15,.42)",
        glow: "0 0 0 4px rgba(255,77,26,.14)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.22,1,.36,1)",
      },
      keyframes: {
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(6%,-4%,0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%,5%,0) scale(.95)" },
        },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "marquee-reverse": { from: { transform: "translateX(-50%)" }, to: { transform: "translateX(0)" } },
        pip: {
          "0%,100%": { transform: "rotate(45deg) scale(1)" },
          "50%": { transform: "rotate(45deg) scale(.82)" },
        },
        ring: { from: { transform: "scale(.6)", opacity: ".55" }, to: { transform: "scale(1.9)", opacity: "0" } },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        rise: { from: { opacity: "0", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        drift: "drift 22s ease-in-out infinite",
        marquee: "marquee 60s linear infinite",
        "marquee-reverse": "marquee-reverse 60s linear infinite",
        pip: "pip 1.4s ease-in-out infinite",
        ring: "ring 1.8s cubic-bezier(.22,1,.36,1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
        rise: "rise .6s cubic-bezier(.22,1,.36,1) both",
      },
    },
  },
  plugins: [],
};
