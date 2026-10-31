// Display-only specimens for each direction: ground, ink and the one color the
// direction is known for. The engine never sees these; it builds real systems.
import { SKILLS } from "./skills.js";
import { fontsUrl } from "./fonts.js";
const SPECIMEN = {
  editorial: ["#FCFCFA", "#17150F", "#A3221B"],
  swiss: ["#FFFFFF", "#0A0A0A", "#E30613"],
  saas: ["#F6F7F5", "#14181A", "#0F766E"],
  luxury: ["#F4EFE6", "#1B1916", "#6B2E2A"],
  brutalist: ["#FFFFFF", "#000000", "#1D2BFF"],
  neopop: ["#FFF8EC", "#15130F", "#FFC93C"],
  expressive: ["#1E1BFF", "#F2FF5A", "#F2FF5A"],
  commerce: ["#FFFFFF", "#111111", "#C2410C"],
  native: ["#F2F2F7", "#000000", "#007AFF"],
  soft: ["#FDEFE8", "#2B1E1A", "#F2643C"],
  instrument: ["#14191D", "#D6DEE2", "#5EEAD4"],
  organic: ["#EEE9DD", "#2E2A22", "#5B6B3A"],
  playful: ["#FFFFFF", "#3A3A3A", "#58CC02"],
  riso: ["#F4EEE1", "#1F3A93", "#FF4F9A"],
  studio: ["#FFFFFF", "#0D0D0D", "#0D0D0D"],
  finance: ["#F4F5F1", "#132A23", "#B8F05C"],
  clinical: ["#F3F7F8", "#15303A", "#2F7F86"],
  enterprise: ["#F7F7F5", "#1A1D24", "#1F2A55"],
};

export const specimen = (id) => SPECIMEN[id] || SPECIMEN.saas;

// Every direction's display face, for specimens.
export const SPECIMEN_FONTS = fontsUrl([...new Set(SKILLS.map((s) => s.defaults.fonts.display))]);


