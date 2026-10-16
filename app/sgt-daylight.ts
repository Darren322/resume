import * as THREE from "three";

/**
 * Natural light through the desk window, following the clock in Singapore.
 * SGT is UTC+8 all year with no daylight saving, and being near the equator
 * the sun rises around 7:00 and sets around 19:10 in every season.
 */

type DaylightKey = {
  hour: number;
  /** Sun or moon light coming in through the window. */
  light: string;
  intensity: number;
  /** Where that light sits behind the back wall (x: east → west, y: height). */
  x: number;
  y: number;
  /** Room fill: hemisphere sky and ground colours, and its resting intensity. */
  sky: string;
  ground: string;
  fill: number;
  /** Glow of the window pane itself. */
  pane: string;
  paneStrength: number;
  /** Scene background and fog. */
  air: string;
};

const night: Omit<DaylightKey, "hour"> = {
  light: "#7d9be0", intensity: 0.55, x: 7, y: 9,
  sky: "#3a4a72", ground: "#0b0709", fill: 0.12,
  pane: "#304a70", paneStrength: 1.2,
  air: "#05070d",
};

const keys: DaylightKey[] = [
  { hour: 0, ...night },
  { hour: 5.6, ...night, light: "#6f84c8", intensity: 0.5 },
  { hour: 6.7, light: "#ff9f7c", intensity: 0.95, x: -8, y: 3.5, sky: "#6a6898", ground: "#1a1210", fill: 0.22, pane: "#e98d78", paneStrength: 1.2, air: "#120f18" },
  { hour: 8, light: "#ffd8ae", intensity: 1.8, x: -6, y: 7, sky: "#8fb1e0", ground: "#2a2018", fill: 0.3, pane: "#b9d6f5", paneStrength: 1.5, air: "#111722" },
  { hour: 12.5, light: "#fff4e6", intensity: 2.2, x: 0, y: 12, sky: "#a8c6ec", ground: "#2e2620", fill: 0.34, pane: "#d4e8ff", paneStrength: 1.7, air: "#131a25" },
  { hour: 17, light: "#ffd29a", intensity: 1.9, x: 5, y: 8, sky: "#9db4d8", ground: "#2b2018", fill: 0.32, pane: "#ecdcbc", paneStrength: 1.6, air: "#12151d" },
  { hour: 18.8, light: "#ff8a4c", intensity: 1.4, x: 8, y: 3.5, sky: "#7a6a8c", ground: "#1e1410", fill: 0.28, pane: "#ff7f50", paneStrength: 1.4, air: "#150f16" },
  { hour: 19.6, light: "#5d6fb8", intensity: 0.65, x: 8, y: 6, sky: "#3e4a80", ground: "#0d0a0c", fill: 0.16, pane: "#2c3f88", paneStrength: 1.1, air: "#080a14" },
  { hour: 21, ...night },
  { hour: 24, ...night },
];

export type Daylight = {
  light: THREE.Color;
  intensity: number;
  position: THREE.Vector3;
  sky: THREE.Color;
  ground: THREE.Color;
  fill: number;
  pane: THREE.Color;
  paneStrength: number;
  air: THREE.Color;
};

/** Hours since midnight in Singapore, e.g. 14.5 for 2:30 PM. */
export function sgtHours(now = new Date()) {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60 + 8 * 60;
  return (minutes % 1440) / 60;
}

/** "2:30 PM" for an SGT hour value. */
export function formatSgt(hours: number) {
  const total = Math.floor(hours * 60) % 1440;
  const hour = Math.floor(total / 60);
  const minute = String(total % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

/** Today's date in Singapore, e.g. "Friday 16 October". */
export function sgtDateLabel(now = new Date()) {
  const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][sgt.getUTCDay()];
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][sgt.getUTCMonth()];
  return `${weekday} ${sgt.getUTCDate()} ${month}`;
}

/** Plain-language part of day, for labels. */
export function partOfDay(hours: number) {
  if (hours >= 5.6 && hours < 12) return "morning";
  if (hours >= 12 && hours < 18) return "afternoon";
  if (hours >= 18 && hours < 20.5) return "evening";
  return "night";
}

const scratchA = new THREE.Color();
const scratchB = new THREE.Color();
const mix = (into: THREE.Color, a: string, b: string, t: number) => into.copy(scratchA.set(a)).lerp(scratchB.set(b), t);

/** Blend the light for an SGT hour into `out` (reused every update). */
export function daylightAt(hours: number, out: Daylight) {
  const h = ((hours % 24) + 24) % 24;
  let index = 0;
  while (index < keys.length - 2 && keys[index + 1].hour <= h) index += 1;
  const a = keys[index];
  const b = keys[index + 1];
  // Smoothstep so each phase eases into the next instead of kinking.
  const raw = THREE.MathUtils.clamp((h - a.hour) / (b.hour - a.hour), 0, 1);
  const t = raw * raw * (3 - 2 * raw);
  mix(out.light, a.light, b.light, t);
  mix(out.sky, a.sky, b.sky, t);
  mix(out.ground, a.ground, b.ground, t);
  mix(out.pane, a.pane, b.pane, t);
  mix(out.air, a.air, b.air, t);
  out.intensity = THREE.MathUtils.lerp(a.intensity, b.intensity, t);
  out.fill = THREE.MathUtils.lerp(a.fill, b.fill, t);
  out.paneStrength = THREE.MathUtils.lerp(a.paneStrength, b.paneStrength, t);
  out.position.set(THREE.MathUtils.lerp(a.x, b.x, t), THREE.MathUtils.lerp(a.y, b.y, t), -9);
  return out;
}

export function createDaylight(): Daylight {
  return {
    light: new THREE.Color(),
    intensity: 0,
    position: new THREE.Vector3(),
    sky: new THREE.Color(),
    ground: new THREE.Color(),
    fill: 0,
    pane: new THREE.Color(),
    paneStrength: 0,
    air: new THREE.Color(),
  };
}

/**
 * The SGT hour to light the desk for. `?sgt=14.5` in the URL pins a time,
 * which is handy for previewing dawn or sunset without waiting for it.
 */
export function currentSgtHours() {
  try {
    const pinned = new URLSearchParams(window.location.search).get("sgt");
    if (pinned !== null && pinned.trim() !== "") {
      const value = Number(pinned);
      if (Number.isFinite(value)) return ((value % 24) + 24) % 24;
    }
  } catch {
    // Fall through to the real clock.
  }
  return sgtHours();
}
