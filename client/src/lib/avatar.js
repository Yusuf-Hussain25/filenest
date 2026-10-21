// Initials and a stable gradient per name, used by avatars.
const GRADIENTS = [
  "linear-gradient(135deg,#38bdf8,#0369a1)",
  "linear-gradient(135deg,#818cf8,#4338ca)",
  "linear-gradient(135deg,#34d399,#0f766e)",
  "linear-gradient(135deg,#fbbf24,#ea580c)",
  "linear-gradient(135deg,#f472b6,#9333ea)",
  "linear-gradient(135deg,#94a3b8,#334155)",
];

export const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export const gradientFor = (seed = "") => {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};
