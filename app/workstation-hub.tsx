"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { renderToStaticMarkup } from "react-dom/server";
import { FaSliders, FaXmark } from "react-icons/fa6";
import { technologyIcon, technologyMarkFor } from "./marks";
import { ObjectSurface, skillList, whereUsed, type SurfaceNode } from "./object-surfaces";
import { resumeData } from "./resume-data";
import { createWorkstationAudio, type WorkstationAudio } from "./workstation-audio";

/** How the content laid over a held artifact's reading surface is dressed. */
type SurfaceSkin = "paper" | "screen" | "phone" | "keys";

type HubHotspot = {
  id: string;
  node: SurfaceNode;
  label: string;
  hint: string;
  skin: SurfaceSkin;
};

// Recruiter priority, which is also Tab and dock order: resume, work and
// projects first (they sit front and centre under the lamp), then the rest.
const hotspots: HubHotspot[] = [
  { id: "overview", node: "overview", label: "At a glance", hint: "Monitor / start here", skin: "screen" },
  { id: "profile", node: "profile", label: "Resume", hint: "One-page resume", skin: "paper" },
  { id: "work", node: "work", label: "Work", hint: "Laptop / experience", skin: "screen" },
  { id: "projects", node: "projects", label: "Projects", hint: "Project folders", skin: "paper" },
  { id: "skills", node: "skills", label: "Skills", hint: "Split keyboard / stack", skin: "keys" },
  { id: "education", node: "education", label: "Education", hint: "Certificate + cap", skin: "paper" },
  { id: "teaching", node: "teaching", label: "Teaching", hint: "Notebook / mentoring", skin: "paper" },
  { id: "contact", node: "contact", label: "Contact", hint: "Phone / get in touch", skin: "phone" },
];

/** A held artifact's reading surface, in its root's local space. */
type ReadingSurface = {
  centre: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  front: THREE.Vector3;
  width: number;
  height: number;
};

/**
 * Desk-only details that would clash with the content shown on a held
 * artifact (labels, placeholder code lines, keycaps…). Hidden while held.
 */
const heldDecor: Record<string, string[]> = {
  overview: ["hotspot-tag-overview"],
  profile: ["profile-badge", "hotspot-tag-profile"],
  work: ["laptop-code-line", "hotspot-tag-work"],
  projects: ["hotspot-tag-projects"],
  skills: ["hotspot-tag-skills"],
  education: ["education-cert-line", "education-seal", "education-cap", "education-tassel", "hotspot-tag-education"],
  teaching: ["notebook-line", "teaching-pen", "hotspot-tag-teaching"],
  contact: ["phone-notification", "hotspot-tag-contact"],
};

const FOV = 34;
const DESK_CENTER = new THREE.Vector3(0, 1.64, 0.35);
const LAMP_AIM = new THREE.Vector3(-0.3, 1.64, 1.0);
const LAMP_INTENSITY = 25;
const INTRO_SECONDS = 2.4;
const INTRO_SEEN_KEY = "dn-workstation-lamp-on";
// Marker-on-masking-tape lettering; matches the notebook's handwriting.
const TAPE_FONT = 'var(--font-hand), "Bradley Hand", "Segoe Print", cursive';

type WorkstationHubProps = {
  /**
   * Integration seam for a future in-scene inspector. The hub owns the
   * physical pickup; consumers can mirror the selected landmark without
   * opening a modal or replacing the workstation canvas.
   */
  onSelectionChange?: (selection: { id: string; node: SurfaceNode; label: string; hint: string } | null) => void;
  /** Called after the selected artifact has completed its return-to-desk motion. */
  onReturn?: () => void;
};

type PickupPhase = "idle" | "lifting" | "held" | "returning";
type PickupState = { phase: PickupPhase; progress: number; targetId: string | null };

/**
 * Frame the whole desk inside the part of the viewport UI leaves free.
 * Landscape looks down at 63°. Portrait phones roll the camera 90° and look
 * down more steeply, so the long side of the desk runs down the screen.
 */
function cameraFraming(width: number, height: number, reserveTop: number, reserveBottom: number) {
  const aspect = width / Math.max(height, 1);
  const portrait = aspect < 0.82;
  const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const freeShare = Math.max(0.45, (height - reserveTop - reserveBottom) / Math.max(height, 1));
  const distance = portrait
    ? Math.max(5.9 / (tanV * freeShare), 2.8 / (tanV * aspect))
    : Math.max(6.1 / (tanV * aspect), 3.1 / (tanV * freeShare));
  return {
    portrait,
    elevation: THREE.MathUtils.degToRad(portrait ? 76 : 63),
    distance,
    // Pixels the desk centre should sit below the viewport centre.
    centreShiftPx: (reserveTop - reserveBottom) / 2,
  };
}

function lampCurve(seconds: number) {
  // Dark room → click → a short filament stutter → warm settle.
  if (seconds < 0.5) return 0;
  if (seconds < 0.56) return 0.75;
  if (seconds < 0.66) return 0.12;
  if (seconds < 0.72) return 0.9;
  const settle = THREE.MathUtils.clamp((seconds - 0.72) / 0.8, 0, 1);
  return 0.62 + 0.38 * (1 - Math.pow(1 - settle, 3));
}

function softDot(size: number, inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Paint a strip of masking tape with the section name in marker-dark mono. */
function paintTape(label: string, fontFamily: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 184;
  const context = canvas.getContext("2d")!;
  const tear = (x: number) => {
    const points: Array<[number, number]> = [];
    for (let y = 0; y <= 184; y += 23) points.push([x + (Math.random() - 0.5) * 18, y]);
    return points;
  };
  const left = tear(14);
  const right = tear(626).reverse();
  context.beginPath();
  context.moveTo(left[0][0], 0);
  left.forEach(([x, y]) => context.lineTo(x, y));
  right.forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
  const fill = context.createLinearGradient(0, 0, 0, 184);
  fill.addColorStop(0, "#e6d6b0");
  fill.addColorStop(1, "#d6c294");
  context.fillStyle = fill;
  context.fill();
  context.save();
  context.clip();
  context.globalAlpha = 0.08;
  for (let index = 0; index < 260; index += 1) {
    context.fillStyle = index % 2 ? "#ffffff" : "#6b5532";
    context.fillRect(Math.random() * 640, Math.random() * 184, 1 + Math.random() * 28, 1);
  }
  context.restore();
  context.fillStyle = "#1b1d24";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 118px ${fontFamily}`;
  const width = context.measureText(label).width;
  if (width > 560) context.font = `700 ${Math.floor(118 * 560 / width)}px ${fontFamily}`;
  context.fillText(label, 320, 98);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // glTF UVs put v=0 at the top of the image.
  texture.flipY = false;
  return texture;
}

/**
 * Paper grain shared by every sheet on the desk, so a page looks the same on
 * the desk and in hand. `punched` adds binder holes for the filed project brief.
 */
/**
 * The monitor's resting screen: the same "At a glance" content the visitor
 * sees when they pick it up, so the desk and the close-up agree.
 */
function paintOverviewScreen(fontFamily: string) {
  const width = 2560;
  const height = Math.round(width / (5.12 / 2.14));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#04060a";
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * 0.15, 0, 0, width * 0.15, 0, width * 0.7);
  glow.addColorStop(0, "rgba(242, 182, 109, 0.10)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  const pad = 130;
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ece7de";
  context.font = `750 190px ${fontFamily}`;
  context.fillText("Darren Ng", pad, pad + 170);
  context.fillStyle = "#c9ced8";
  context.font = `400 52px ${fontFamily}`;
  context.fillText("Software engineer building events platforms, data pipelines and multi-agent systems.", pad, pad + 270);
  const results = [resumeData.work.items[0], resumeData.projects.items[0], resumeData.projects.items[2]];
  const cardWidth = (width - pad * 2 - 80) / 3;
  results.forEach((item, index) => {
    if (!item?.highlight) return;
    const left = pad + index * (cardWidth + 40);
    const top = pad + 360;
    context.strokeStyle = "rgba(236, 231, 222, 0.14)";
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(left, top, cardWidth, height - top - pad, 28);
    context.stroke();
    context.fillStyle = "#f2b66d";
    context.font = `750 132px ${fontFamily}`;
    context.fillText(item.highlight.value, left + 50, top + 170);
    context.fillStyle = "#d8dce4";
    context.font = `400 44px ${fontFamily}`;
    const words = item.highlight.label.split(" ");
    let line = "";
    let y = top + 250;
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > cardWidth - 100) {
        context.fillText(line, left + 50, y);
        line = word;
        y += 58;
      } else line = next;
    });
    context.fillText(line, left + 50, y);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

function paintPaper(punched: boolean) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f4efe6";
  context.fillRect(0, 0, size, size);
  // Soft mottling, then pulp speckle, then a few long fibres.
  for (let index = 0; index < 26; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 80 + Math.random() * 220;
    const blotch = context.createRadialGradient(x, y, 0, x, y, radius);
    blotch.addColorStop(0, Math.random() > 0.5 ? "rgba(120, 100, 70, 0.05)" : "rgba(255, 255, 255, 0.06)");
    blotch.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = blotch;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  const pixels = context.getImageData(0, 0, size, size);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = (Math.random() - 0.5) * 14;
    pixels.data[index] += grain;
    pixels.data[index + 1] += grain;
    pixels.data[index + 2] += grain;
  }
  context.putImageData(pixels, 0, 0);
  context.lineWidth = 1;
  for (let index = 0; index < 900; index += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 6 + Math.random() * 26;
    const angle = Math.random() * Math.PI;
    context.strokeStyle = Math.random() > 0.5 ? "rgba(255, 255, 255, 0.35)" : "rgba(110, 90, 60, 0.12)";
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + Math.cos(angle) * length * 0.5 + 3, y + Math.sin(angle) * length * 0.5, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
  if (punched) {
    // The brief is wider than tall (1.2 × 0.86), so squeeze x to keep holes round.
    for (const y of [0.22, 0.5, 0.78]) {
      context.save();
      context.translate(26, y * size);
      context.scale(0.86 / 1.2, 1);
      const hole = context.createRadialGradient(0, 0, 4, 0, 0, 15);
      hole.addColorStop(0, "#2a241d");
      hole.addColorStop(0.8, "#3d342a");
      hole.addColorStop(1, "rgba(60, 50, 40, 0)");
      context.fillStyle = hole;
      context.beginPath();
      context.arc(0, 0, 15, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/** A keycap top with its skill legend, matching the 3D cyan-blue caps. */
function paintKeycap(label: string, aspect: number, fontFamily: string, logoSvg?: string) {
  const width = 256;
  const height = Math.round(width / aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const cap = context.createLinearGradient(0, 0, 0, height);
  cap.addColorStop(0, "#5ccdf1");
  cap.addColorStop(1, "#2bb3e3");
  context.fillStyle = cap;
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#052a38";
  context.textAlign = "center";
  context.textBaseline = "middle";
  // With a logo, the legend sits in the lower half and the logo above it.
  const textTop = logoSvg ? height * 0.48 : 0;
  // Long single words break where a reader would: "Open Telemetry", "Express .js".
  context.font = `650 54px ${fontFamily}`;
  const words = label.split(" ").flatMap((word) =>
    context.measureText(word).width > width - 36 ? word.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\.(\w+)$/, " .$1").split(" ") : [word],
  );
  // One legend size across the board (like real keycaps); only very long words shrink.
  let size = 54;
  const fits = () => {
    context.font = `650 ${size}px ${fontFamily}`;
    return words.every((word) => context.measureText(word).width <= width - 36) && words.length * size * 1.08 <= height - textTop - 40;
  };
  if (logoSvg) size = Math.min(size, 40);
  while (size > 22 && !fits()) size -= 2;
  const textCentre = logoSvg ? textTop + (height - textTop) / 2 - 8 : height / 2;
  words.forEach((word, index) => {
    context.fillText(word, width / 2, textCentre + (index - (words.length - 1) / 2) * size * 1.08);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  if (logoSvg) {
    const image = new Image();
    image.onload = () => {
      const logo = Math.min(width * 0.42, height * 0.34);
      context.drawImage(image, (width - logo) / 2, height * 0.1, logo, logo);
      texture.needsUpdate = true;
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`;
  }
  return texture;
}

const vignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uStrength: { value: 0.42 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float edge = smoothstep(0.82, 0.22, distance(vUv, vec2(0.5)));
      color.rgb *= mix(1.0 - uStrength, 1.0, edge);
      color.rgb += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
      gl_FragColor = color;
    }
  `,
};

export function WorkstationHub({ onSelectionChange, onReturn }: WorkstationHubProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const anchorRefs = useRef(new Map<string, HTMLButtonElement>());
  const surfaceRef = useRef<HTMLDivElement>(null);
  // The resume is read on the 3D paper itself: scroll and pan in px, zoom as a factor.
  const readingRef = useRef({ scroll: -1e6, panX: 0, zoom: 1 });
  const focusedSkillRef = useRef<string | null>(null);
  // Visitor's lamp dimmer (1 = as designed). Clicking the lamp steps through presets.
  const [lampLevel, setLampLevel] = useState(1);
  // The view controls can be tucked away into a single corner button.
  const [controlsOpen, setControlsOpen] = useState(true);
  const lampLevelRef = useRef(1);
  // A different object clicked while one is held: picked up once this one is back.
  const pendingPickRef = useRef<HubHotspot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [introComplete, setIntroComplete] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [touchFirst, setTouchFirst] = useState(false);
  // The skill under the pointer (or last tapped) on the held keyboard.
  const [focusedSkill, setFocusedSkill] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onReturnRef = useRef(onReturn);
  const zoomRef = useRef(1);
  const zoomTargetRef = useRef(1);
  const introElapsedRef = useRef(0);
  const robotHopRef = useRef(-1);
  const audioRef = useRef<WorkstationAudio | null>(null);
  const pickupRef = useRef<PickupState>({ phase: "idle", progress: 0, targetId: null });

  const activeHotspot = useMemo(() => hotspots.find((hotspot) => hotspot.id === activeId), [activeId]);
  const selectedHotspot = useMemo(() => hotspots.find((hotspot) => hotspot.id === selectedId), [selectedId]);

  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onReturnRef.current = onReturn;
  }, [onReturn, onSelectionChange]);

  useEffect(() => {
    setTouchFirst(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    focusedSkillRef.current = focusedSkill;
  }, [focusedSkill]);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem("dn-lamp-level"));
      if (saved >= 0.3 && saved <= 1.6) setLampLevel(saved);
    } catch {
      // Storage is a convenience only.
    }
  }, []);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("dn-controls-open") === "0") setControlsOpen(false);
    } catch {
      // Storage is a convenience only.
    }
  }, []);

  const toggleControls = useCallback((open: boolean) => {
    setControlsOpen(open);
    try {
      window.localStorage.setItem("dn-controls-open", open ? "1" : "0");
    } catch {
      // Storage is a convenience only.
    }
  }, []);

  useEffect(() => {
    lampLevelRef.current = lampLevel;
    try {
      window.localStorage.setItem("dn-lamp-level", String(lampLevel));
    } catch {
      // Storage is a convenience only.
    }
  }, [lampLevel]);

  useEffect(() => {
    const audio = createWorkstationAudio();
    audioRef.current = audio;
    return () => {
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  const setHotspot = useCallback((hotspot: HubHotspot | null) => {
    // Keep the picked artifact as the only active landmark while it is held.
    if (selectedIdRef.current && hotspot?.id !== selectedIdRef.current) return;
    const nextId = hotspot?.id ?? null;
    if (activeIdRef.current === nextId) return;
    activeIdRef.current = nextId;
    setActiveId(nextId);
  }, []);

  const activate = useCallback((hotspot: HubHotspot) => {
    // A selected artifact owns the stage until it is returned. This prevents
    // a second hotspot from interrupting the pickup or changing its target.
    if (selectedIdRef.current || pickupRef.current.phase !== "idle") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeIdRef.current = hotspot.id;
    selectedIdRef.current = hotspot.id;
    setActiveId(hotspot.id);
    setSelectedId(hotspot.id);
    pickupRef.current = { phase: reduced ? "held" : "lifting", progress: reduced ? 1 : 0, targetId: hotspot.id };
    readingRef.current = { scroll: -1e6, panX: -1e6, zoom: 1 };
    setFocusedSkill(null);
    audioRef.current?.rustle();
    onSelectionChangeRef.current?.({ id: hotspot.id, node: hotspot.node, label: hotspot.label, hint: hotspot.hint });
  }, []);

  const closeSelection = useCallback(() => {
    const targetId = selectedIdRef.current;
    if (!targetId || pickupRef.current.phase === "returning") return;
    audioRef.current?.rustle();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      pickupRef.current = { phase: "idle", progress: 0, targetId: null };
      selectedIdRef.current = null;
      activeIdRef.current = null;
      setSelectedId(null);
      setActiveId(null);
      onSelectionChangeRef.current?.(null);
      onReturnRef.current?.();
      return;
    }
    pickupRef.current = { phase: "returning", progress: 0, targetId };
  }, []);

  const openFromOverview = useCallback((node: SurfaceNode) => {
    const target = hotspots.find((hotspot) => hotspot.node === node);
    if (!target) return;
    pendingPickRef.current = target;
    closeSelection();
  }, [closeSelection]);

  const skipIntro = useCallback(() => {
    introElapsedRef.current = Math.max(introElapsedRef.current, INTRO_SECONDS);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (introElapsedRef.current < INTRO_SECONDS) skipIntro();
      if (selectedIdRef.current === "profile" && !(event.target instanceof HTMLInputElement)) {
        const reading = readingRef.current;
        const steps: Record<string, () => void> = {
          ArrowDown: () => { reading.scroll += 90; },
          ArrowUp: () => { reading.scroll -= 90; },
          PageDown: () => { reading.scroll += 420; },
          PageUp: () => { reading.scroll -= 420; },
          " ": () => { reading.scroll += 420; },
          "+": () => { reading.zoom = Math.min(2.6, reading.zoom * 1.2); },
          "=": () => { reading.zoom = Math.min(2.6, reading.zoom * 1.2); },
          "-": () => { reading.zoom = Math.max(1, reading.zoom / 1.2); },
        };
        const step = steps[event.key];
        if (step) {
          event.preventDefault();
          step();
          return;
        }
      }
      if (event.key !== "Escape" || !selectedIdRef.current) return;
      event.preventDefault();
      closeSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeSelection, skipIntro]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    } catch {
      setStatus("fallback");
      return;
    }

    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seenIntro = false;
    try {
      seenIntro = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch {
      // Private windows can block storage; the intro simply plays again.
    }
    introElapsedRef.current = reduced || seenIntro ? INTRO_SECONDS : 0;
    let introReported = false;

    const scene = new THREE.Scene();
    const nightColor = new THREE.Color("#05070d");
    scene.background = nightColor;
    const fog = new THREE.FogExp2(nightColor, 0.022);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 90);
    scene.add(camera);
    const cameraBase = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const portraitUp = new THREE.Vector3(-1, 0, 0);
    const landscapeUp = new THREE.Vector3(0, 1, 0);
    let framing = cameraFraming(1, 1, 0, 0);
    let viewport = { width: 1, height: 1, mobile: false };

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // Lighting: one warm lamp pool, moonlight from the window, screen spill.
    const ambient = new THREE.HemisphereLight("#3a4a72", "#0b0709", 0.12);
    scene.add(ambient);
    // Decay 1 (not physical 2) keeps the pool wide and soft instead of a hot spot.
    const lamp = new THREE.SpotLight("#ffc283", 0, 0, 1.22, 1, 1);
    lamp.position.set(-3.25, 4.15, -0.25);
    lamp.target.position.copy(LAMP_AIM);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(isCoarse ? 1024 : 2048, isCoarse ? 1024 : 2048);
    lamp.shadow.camera.near = 0.4;
    lamp.shadow.camera.far = 14;
    lamp.shadow.bias = -0.0004;
    lamp.shadow.normalBias = 0.02;
    lamp.shadow.radius = 4;
    scene.add(lamp, lamp.target);
    const moon = new THREE.DirectionalLight("#7d9be0", 0.55);
    moon.position.set(7, 9, -9);
    scene.add(moon);
    const monitorGlow = new THREE.PointLight("#4fc3dc", 2.6, 0, 2);
    monitorGlow.position.set(-1.1, 3.0, -0.4);
    scene.add(monitorGlow);
    // Warm bounce off the desk so the left corner never falls into shadow.
    const bounce = new THREE.PointLight("#ffb27a", 0, 0, 1);
    bounce.position.set(-3.8, 2.9, 1.9);
    scene.add(bounce);
    // Inspection light rides with the camera so a held artifact never leaves the light.
    const inspectLight = new THREE.PointLight("#fff1de", 0, 0, 2);
    inspectLight.position.set(1.4, 1.6, -0.6);
    camera.add(inspectLight);

    // Post-processing: AO for contact shadows, light bloom on screens and the
    // bulb, then a vignette with fine grain. No tilt-shift: it blurs the
    // top-row objects people need to read.
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, renderTarget);
    composer.addPass(new RenderPass(scene, camera));
    const useAo = !isCoarse;
    let gtao: GTAOPass | null = null;
    if (useAo) {
      gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
      gtao.blendIntensity = 0.85;
      composer.addPass(gtao);
    }
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.55, 0.92);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const finish = new ShaderPass(vignetteGrainShader);
    composer.addPass(finish);

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const width = Math.max(rect.width, 1);
      const height = Math.max(rect.height, 1);
      const mobile = width < 720;
      const dock = dockRef.current;
      const dockHeight = dock && dock.offsetParent !== null ? dock.offsetHeight + 16 : 0;
      viewport = { width, height, mobile };
      framing = cameraFraming(width, height, mobile ? 64 : 76, mobile ? dockHeight + 44 : 72);
      fog.density = 0.022 * 12.5 / framing.distance;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    };

    // Scene references resolved after the GLB loads.
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const interactiveRoots = new Map<string, THREE.Object3D>();
    const ownedTextures = new Set<THREE.Texture>();
    const ownedMaterials = new Set<THREE.Material>();
    let mountedModel: THREE.Object3D | null = null;
    let monitorMaterial: THREE.MeshBasicMaterial | null = null;
    let bulbMaterial: THREE.MeshStandardMaterial | null = null;
    let notificationMaterial: THREE.MeshStandardMaterial | null = null;
    let cursorLine: THREE.Object3D | null = null;
    const decorObjects = new Map<string, THREE.Object3D[]>();
    const skillCaps = new Map<string, THREE.Mesh>();
    let litSkill: string | null = null;
    const keyAt = (clientX: number, clientY: number) => {
      if (!mountedModel) return null;
      const rect = root.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObject(mountedModel, true).find((entry) => entry.object.visible);
      return (hit?.object.userData.skill as string | undefined) ?? null;
    };
    const isLampAt = (clientX: number, clientY: number) => {
      if (!mountedModel) return false;
      const rect = root.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObject(mountedModel, true).find((entry) => entry.object.visible);
      return Boolean(hit?.object.name.startsWith("desk-lamp"));
    };
    const pressKey = (skill: string) => {
      const cap = skillCaps.get(skill);
      if (!cap) return;
      const parts = [cap, cap.userData.body as THREE.Object3D | undefined].filter(Boolean) as THREE.Object3D[];
      parts.forEach((part) => { part.position.y -= 0.025; });
      window.setTimeout(() => parts.forEach((part) => { part.position.y += 0.025; }), 140);
    };
    const screenMaterials = new Set<THREE.MeshStandardMaterial>();
    const offScreen = new THREE.Color("#020203");
    let robotHead: THREE.Object3D | null = null;
    const robotGroup = new THREE.Group();
    robotGroup.name = "guide-robot";
    const robotEyes: THREE.Object3D[] = [];
    let disposed = false;

    const ownMaterial = <T extends THREE.Material>(mesh: THREE.Mesh, next: T) => {
      ownedMaterials.add(next);
      mesh.material = next;
      return next;
    };

    const applyArtwork = (meshName: string, url: string, onReady?: (material: THREE.MeshBasicMaterial) => void, lit = false) => {
      textureLoader.load(url, (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        ownedTextures.add(texture);
        const mesh = mountedModel?.getObjectByName(meshName);
        if (!(mesh instanceof THREE.Mesh)) return;
        if (lit) {
          // Slightly off-white so the lamp never clips the page to pure white.
          ownMaterial(mesh, new THREE.MeshStandardMaterial({ map: texture, color: "#c9c2b6", roughness: 0.9, side: THREE.DoubleSide }));
          return;
        }
        const material = ownMaterial(mesh, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        onReady?.(material);
      }, undefined, () => {
        // The desk remains usable with its authored placeholder if an image is unavailable.
      });
    };

    // Ambient life: dust drifting through the lamp beam and steam off the mug.
    const dustCount = isCoarse ? 90 : 180;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSeeds = new Float32Array(dustCount);
    const dustScratch = new THREE.Vector3();
    const spawnDust = (index: number) => {
      const t = 0.15 + Math.random() * 0.85;
      const spread = t * 2.1;
      dustScratch.copy(lamp.position).lerp(LAMP_AIM, t);
      dustScratch.x += (Math.random() - 0.5) * spread;
      dustScratch.z += (Math.random() - 0.5) * spread;
      dustScratch.y = Math.max(dustScratch.y, 1.75);
      dustPositions.set([dustScratch.x, dustScratch.y, dustScratch.z], index * 3);
      dustSeeds[index] = Math.random() * 100;
    };
    for (let index = 0; index < dustCount; index += 1) spawnDust(index);
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustTexture = softDot(64, "rgba(255,255,255,1)", "rgba(255,255,255,0)");
    ownedTextures.add(dustTexture);
    const dustMaterial = new THREE.PointsMaterial({ size: 0.045, map: dustTexture, color: "#ffd9a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    scene.add(dust);

    const steamCount = 7;
    const steamPositions = new Float32Array(steamCount * 3);
    const steamGeometry = new THREE.BufferGeometry();
    steamGeometry.setAttribute("position", new THREE.BufferAttribute(steamPositions, 3));
    const steamTexture = softDot(128, "rgba(255,255,255,0.9)", "rgba(255,255,255,0)");
    ownedTextures.add(steamTexture);
    const steamMaterial = new THREE.PointsMaterial({ size: 0.55, map: steamTexture, color: "#e9e3d8", transparent: true, opacity: 0.1, depthWrite: false });
    const steam = new THREE.Points(steamGeometry, steamMaterial);
    steam.frustumCulled = false;
    const mugTop = new THREE.Vector3(-3.55, 2.06, -0.35);
    scene.add(steam);

    const hotspotIds = new Set(hotspots.map((hotspot) => hotspot.id));
    // Canvas text cannot read CSS variables: resolve the handwriting family.
    const handFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-hand").trim();
    const tapeFont = handFamily ? `${handFamily}, "Bradley Hand", cursive` : TAPE_FONT;
    const displayFamilyName = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
    const fontReady = Promise.all([
      document.fonts.load(`700 118px ${tapeFont}`),
      displayFamilyName ? document.fonts.load(`750 120px ${displayFamilyName}`) : Promise.resolve(),
    ]).catch(() => undefined);
    loader.load(
      "/assets/workstation.glb",
      async (gltf) => {
        await fontReady;
        if (disposed) return;
        mountedModel = gltf.scene;
        mountedModel.name = "workstation-glb";
        const robotParts: THREE.Object3D[] = [];
        mountedModel.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = !object.name.startsWith("room-");
            object.receiveShadow = true;
          }
          if (object.name.startsWith("hotspot-root-")) {
            const hotspotId = object.name.replace("hotspot-root-", "");
            if (!hotspotIds.has(hotspotId)) return;
            interactiveRoots.set(hotspotId, object);
            object.userData.basePosition = object.position.clone();
            object.userData.baseQuaternion = object.quaternion.clone();
          }
          if (object.name.startsWith("guide-robot") && object.parent === mountedModel) robotParts.push(object);
        });
        modelRoot.add(mountedModel);
        mountedModel.updateMatrixWorld(true);

        // Each artifact carries an invisible `surface-<id>` plane: the face that
        // turns toward the viewer when held, and where its content is laid.
        interactiveRoots.forEach((interactiveRoot, id) => {
          const plane = interactiveRoot.getObjectByName(`surface-${id}`);
          if (!(plane instanceof THREE.Mesh)) return;
          plane.visible = false;
          plane.castShadow = false;
          plane.updateMatrix();
          plane.geometry.computeBoundingBox();
          const box = plane.geometry.boundingBox!;
          const size = box.getSize(new THREE.Vector3());
          const front = new THREE.Vector3(0, 1, 0).applyQuaternion(plane.quaternion);
          const up = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
          const surface: ReadingSurface = {
            centre: box.getCenter(new THREE.Vector3()).applyMatrix4(plane.matrix),
            right: new THREE.Vector3().crossVectors(up, front).normalize(),
            up,
            front,
            width: size.x * plane.scale.x,
            height: size.z * plane.scale.z,
          };
          interactiveRoot.userData.surface = surface;
        });

        hotspots.forEach((hotspot) => {
          const tape = mountedModel!.getObjectByName(`hotspot-tag-${hotspot.id}`);
          if (!(tape instanceof THREE.Mesh)) return;
          const texture = paintTape(hotspot.label, tapeFont);
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(texture);
          ownMaterial(tape, new THREE.MeshStandardMaterial({ map: texture, alphaTest: 0.5, roughness: 0.92, side: THREE.DoubleSide }));
          tape.castShadow = false;
        });

        // Skill legends on the real keycaps, in reading order: back row first, left to right.
        const skillsRoot = interactiveRoots.get("skills");
        if (skillsRoot) {
          const uiFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
          const caps: Array<{ mesh: THREE.Mesh; at: THREE.Vector3 }> = [];
          const keys: Array<{ mesh: THREE.Object3D; at: THREE.Vector3 }> = [];
          skillsRoot.traverse((object) => {
            if (object instanceof THREE.Mesh && object.name.startsWith("keyboard-legend")) caps.push({ mesh: object, at: object.getWorldPosition(new THREE.Vector3()) });
            if (object.name.startsWith("keyboard-key") || object.name.startsWith("keyboard-thumb-key")) keys.push({ mesh: object, at: object.getWorldPosition(new THREE.Vector3()) });
          });
          caps.sort((a, b) => (Math.abs(a.at.z - b.at.z) > 0.08 ? a.at.z - b.at.z : a.at.x - b.at.x));
          const skills = resumeData.skills.items.flatMap((row) => skillList(row));
          caps.forEach((cap, index) => {
            const skill = skills[index];
            if (!skill) return;
            cap.mesh.geometry.computeBoundingBox();
            const box = cap.mesh.geometry.boundingBox!.getSize(new THREE.Vector3());
            const mark = technologyMarkFor(skill);
            const Icon = mark ? technologyIcon(mark) : undefined;
            const logoSvg = Icon ? renderToStaticMarkup(<Icon color="#052a38" size={256} />) : undefined;
            const texture = paintKeycap(skill, box.x / box.z, uiFamily, logoSvg);
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            ownedTextures.add(texture);
            ownMaterial(cap.mesh, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, emissive: "#f2b66d", emissiveIntensity: 0 }));
            cap.mesh.userData.skill = skill;
            // The keycap body under this top answers to the same skill.
            const body = keys.reduce((best, key) => (key.at.distanceToSquared(cap.at) < best.at.distanceToSquared(cap.at) ? key : best), keys[0]);
            if (body) {
              body.mesh.userData.skill = skill;
              cap.mesh.userData.body = body.mesh;
            }
            skillCaps.set(skill, cap.mesh);
          });
        }

        // Paper grain on every sheet; the project brief also gets binder holes.
        const paperGrain = paintPaper(false);
        const briefGrain = paintPaper(true);
        [paperGrain, briefGrain].forEach((texture) => {
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(texture);
        });
        const paperMaterials = new Set<THREE.MeshStandardMaterial>();
        mountedModel.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.name === "Warm Paper") {
            paperMaterials.add(object.material);
          }
        });
        paperMaterials.forEach((material) => {
          material.map = paperGrain;
          material.roughness = 0.92;
          material.needsUpdate = true;
        });
        const brief = mountedModel.getObjectByName("projects-brief");
        if (brief instanceof THREE.Mesh) {
          ownMaterial(brief, new THREE.MeshStandardMaterial({ map: briefGrain, color: "#e3dccd", roughness: 0.92 }));
        }

        const shade = mountedModel.getObjectByName("desk-lamp-shade");
        if (shade) shade.getWorldPosition(lamp.position);
        const bulb = mountedModel.getObjectByName("desk-lamp-bulb");
        if (bulb instanceof THREE.Mesh) {
          bulbMaterial = ownMaterial(bulb, new THREE.MeshStandardMaterial({ color: "#ffe2b0", emissive: "#ffb867", emissiveIntensity: 0 }));
          bulb.castShadow = false;
        }
        const notification = mountedModel.getObjectByName("phone-notification");
        if (notification instanceof THREE.Mesh) {
          notificationMaterial = ownMaterial(notification, new THREE.MeshStandardMaterial({ color: "#0f9fb3", emissive: "#3fd9ee", emissiveIntensity: 1.5 }));
        }
        interactiveRoots.forEach((interactiveRoot, id) => {
          const prefixes = heldDecor[id] ?? [];
          const found: THREE.Object3D[] = [];
          interactiveRoot.traverse((object) => {
            if (object !== interactiveRoot && prefixes.some((prefix) => object.name.startsWith(prefix))) found.push(object);
          });
          decorObjects.set(id, found);
        });
        ["laptop-display", "contact-phone-screen"].forEach((name) => {
          const mesh = mountedModel!.getObjectByName(name);
          if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.userData.baseEmissive = mesh.material.emissiveIntensity;
            mesh.material.userData.baseColor = mesh.material.color.clone();
            screenMaterials.add(mesh.material);
          }
        });
        const codeLines: THREE.Object3D[] = [];
        mountedModel.traverse((object) => {
          if (object.name.startsWith("laptop-code-line")) codeLines.push(object);
        });
        codeLines.sort((a, b) => a.name.localeCompare(b.name));
        cursorLine = codeLines.at(-1) ?? null;

        robotParts.forEach((part) => robotGroup.attach(part));
        mountedModel.add(robotGroup);
        robotHead = robotGroup.getObjectByName("guide-robot-head") ?? null;
        if (robotHead) robotHead.rotation.order = "YXZ";
        robotGroup.traverse((object) => {
          if (object.name.startsWith("guide-robot-eye")) robotEyes.push(object);
        });

        // Keep artwork out of the GLB image table. This avoids blob URL races
        // when the hub unmounts and makes both planes use one predictable loader.
        const monitorScreen = mountedModel.getObjectByName("monitor-portfolio-screen");
        if (monitorScreen instanceof THREE.Mesh) {
          const displayFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
          const screenTexture = paintOverviewScreen(displayFamily);
          screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(screenTexture);
          monitorMaterial = ownMaterial(monitorScreen, new THREE.MeshBasicMaterial({ map: screenTexture, side: THREE.DoubleSide }));
        }
        // The resume is paper, so it takes the lamp light instead of glowing.
        applyArtwork("profile-resume-paper", "/assets/resume-page-1.png", undefined, true);
        resize();
        setStatus("ready");
      },
      undefined,
      () => setStatus("fallback"),
    );

    // Pointer input: hover previews, click picks up, wheel/pinch zooms.
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const pointer = { x: 0, y: 0, inside: false };
    const smoothPointer = { x: 0, y: 0 };
    const touchPoints = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;

    const insideSurface = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(".workstation-surface"));

    const pick = (clientX: number, clientY: number) => {
      if (!mountedModel) return null;
      const rect = root.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.intersectObject(mountedModel, true)[0];
      let current: THREE.Object3D | null = hit?.object ?? null;
      while (current && current !== mountedModel) {
        if (current === robotGroup) return "robot" as const;
        if (current.name.startsWith("hotspot-root-")) {
          const id = current.name.replace("hotspot-root-", "");
          return hotspots.find((hotspot) => hotspot.id === id) ?? null;
        }
        current = current.parent;
      }
      return null;
    };

    const isReading = () => selectedIdRef.current === "profile" && pickupRef.current.phase === "held";
    const drag = { active: false, moved: false, x: 0, y: 0, scroll: 0, panX: 0 };

    const onPointerMove = (event: PointerEvent) => {
      if (drag.active && touchPoints.size < 2) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true;
        readingRef.current.scroll = drag.scroll - dy;
        readingRef.current.panX = drag.panX - dx;
        if (event.cancelable) event.preventDefault();
      }
      if (event.pointerType === "touch") {
        const previous = touchPoints.get(event.pointerId);
        if (!previous) return;
        previous.x = event.clientX;
        previous.y = event.clientY;
        if (touchPoints.size < 2) return;
        const points = Array.from(touchPoints.values());
        const nextDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (pinchDistance > 0 && nextDistance > 0) {
          // Spreading fingers zooms in; pinching them together zooms out.
          // There is deliberately no pan/orbit gesture in this workspace.
          if (isReading()) {
            readingRef.current.zoom = THREE.MathUtils.clamp(readingRef.current.zoom * (nextDistance / pinchDistance), 1, 2.6);
          } else {
            zoomTargetRef.current = THREE.MathUtils.clamp(zoomTargetRef.current - (nextDistance - pinchDistance) * 0.0012, 0.78, 1.24);
          }
          if (event.cancelable) event.preventDefault();
        }
        pinchDistance = nextDistance;
        return;
      }
      const rect = root.getBoundingClientRect();
      pointer.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointer.y = THREE.MathUtils.clamp(-(((event.clientY - rect.top) / rect.height) * 2 - 1), -1, 1);
      pointer.inside = true;
      if (selectedIdRef.current === "skills" && pickupRef.current.phase === "held") {
        const skill = keyAt(event.clientX, event.clientY);
        root.style.cursor = skill ? "pointer" : "";
        if (skill) setFocusedSkill(skill);
        return;
      }
      if (selectedIdRef.current) return;
      const hit = pick(event.clientX, event.clientY);
      root.style.cursor = hit || isLampAt(event.clientX, event.clientY) ? "pointer" : "";
      setHotspot(hit && hit !== "robot" ? hit : null);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (introElapsedRef.current < INTRO_SECONDS) skipIntro();
      if (isReading() && !insideSurface(event.target)) {
        drag.active = true;
        drag.moved = false;
        drag.x = event.clientX;
        drag.y = event.clientY;
        drag.scroll = readingRef.current.scroll;
        drag.panX = readingRef.current.panX;
      }
      if (event.pointerType !== "touch" || insideSurface(event.target)) return;
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touchPoints.size === 2) {
        const points = Array.from(touchPoints.values());
        pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      }
    };
    const onPointerEnd = (event: PointerEvent) => {
      drag.active = false;
      if (event.pointerType !== "touch") return;
      touchPoints.delete(event.pointerId);
      if (touchPoints.size < 2) pinchDistance = 0;
    };
    const onWheel = (event: WheelEvent) => {
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1;
      if (isReading()) {
        // Scroll slides the paper; ctrl/⌘-scroll (and trackpad pinch) zooms it.
        const reading = readingRef.current;
        if (event.ctrlKey || event.metaKey) reading.zoom = THREE.MathUtils.clamp(reading.zoom * Math.exp(-event.deltaY * multiplier * 0.01), 1, 2.6);
        else {
          reading.scroll += event.deltaY * multiplier;
          reading.panX += event.deltaX * multiplier;
        }
        if (event.cancelable) event.preventDefault();
        return;
      }
      // Let the held artifact's content scroll natively.
      if (event.deltaY === 0 || insideSurface(event.target)) return;
      const delta = THREE.MathUtils.clamp(event.deltaY * multiplier, -140, 140);
      zoomTargetRef.current = THREE.MathUtils.clamp(zoomTargetRef.current + delta * 0.0012, 0.78, 1.24);
      if (event.cancelable) event.preventDefault();
    };
    const onPointerLeave = () => {
      pointer.inside = false;
      root.style.cursor = "";
      setHotspot(null);
    };
    const onCanvasClick = (event: MouseEvent) => {
      // A drag that slid the paper is not a click on the background.
      if (drag.moved) {
        drag.moved = false;
        return;
      }
      if (selectedIdRef.current === "skills" && pickupRef.current.phase === "held") {
        const skill = keyAt(event.clientX, event.clientY);
        if (skill) {
          setFocusedSkill(skill);
          pressKey(skill);
          audioRef.current?.rustle();
          return;
        }
      }
      const hit = pick(event.clientX, event.clientY);
      if (selectedIdRef.current) {
        // Clicking the background puts the artifact back; clicking another
        // object puts this one back and then picks that one up.
        if (hit && hit !== "robot" && hit.id === selectedIdRef.current) return;
        pendingPickRef.current = hit && hit !== "robot" ? hit : null;
        closeSelection();
        return;
      }
      if (hit === "robot") robotHopRef.current = 0;
      else if (hit) activate(hit);
      else if (isLampAt(event.clientX, event.clientY)) {
        // Dim → as designed → bright, like a three-step touch lamp.
        setLampLevel((level) => (level < 0.8 ? 1 : level < 1.2 ? 1.45 : 0.55));
      }
    };
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointerup", onPointerEnd, { passive: true });
    root.addEventListener("pointercancel", onPointerEnd, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave, { passive: true });
    root.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onCanvasClick);

    resize();

    // Scratch objects for the frame loop.
    const parentQuaternion = new THREE.Quaternion();
    const basisQuaternion = new THREE.Quaternion();
    const holdQuaternion = new THREE.Quaternion();
    const desiredQuaternion = new THREE.Quaternion();
    const basisMatrix = new THREE.Matrix4();
    const worldHold = new THREE.Quaternion();
    const screenRight = new THREE.Vector3();
    const screenUp = new THREE.Vector3();
    const corner = new THREE.Vector3();
    const baseWorld = new THREE.Vector3();
    const holdWorld = new THREE.Vector3();
    const desiredWorld = new THREE.Vector3();
    const centreOffset = new THREE.Vector3();
    let surfaceShownFor: string | null = null;
    let decorHiddenFor: string | null = null;
    const lookPoint = new THREE.Vector3();
    const headWorld = new THREE.Vector3();
    const anchorWorld = new THREE.Vector3();
    const anchorPositions = new Map<string, string>();

    let visible = true;
    let frame = 0;
    let lastTime = performance.now();
    let clock = 0;

    const render = (time: number) => {
      frame = 0;
      if (!visible) return;
      const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 1 / 30);
      lastTime = time;
      clock += dt;
      const alpha = reduced ? 1 : 1 - Math.pow(1 - 0.08, dt * 60);
      smoothPointer.x += ((pointer.inside ? pointer.x : 0) - smoothPointer.x) * alpha;
      smoothPointer.y += ((pointer.inside ? pointer.y : 0) - smoothPointer.y) * alpha;

      // Lamp-on intro.
      if (mountedModel) introElapsedRef.current += dt;
      const introSeconds = introElapsedRef.current;
      const introDone = introSeconds >= INTRO_SECONDS;
      if (introDone && !introReported) {
        introReported = true;
        setIntroComplete(true);
        try {
          window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
        } catch {
          // Storage is a convenience only.
        }
      }
      const introEase = 1 - Math.pow(1 - THREE.MathUtils.clamp((introSeconds - 0.3) / 2.1, 0, 1), 3);

      const pickup = pickupRef.current;
      const pickupEase = pickup.phase === "lifting" || pickup.phase === "held"
        ? (pickup.phase === "held" ? 1 : 1 - Math.pow(1 - Math.min(pickup.progress, 1), 3))
        : pickup.phase === "returning"
          ? 1 - (1 - Math.pow(1 - Math.min(pickup.progress, 1), 3))
          : 0;

      // Camera: framed base pose, zoom, then parallax or a slow phone drift.
      zoomRef.current += (zoomTargetRef.current - zoomRef.current) * (reduced ? 1 : Math.min(1, dt * 9));
      const distance = framing.distance * zoomRef.current * (1 + 0.12 * (1 - introEase));
      const { elevation } = framing;
      camera.up.copy(framing.portrait ? portraitUp : landscapeUp);
      cameraBase.set(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(distance).add(DESK_CENTER);
      camera.position.copy(cameraBase);
      camera.lookAt(DESK_CENTER);
      camera.updateMatrixWorld();
      cameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
      cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
      const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const worldPerPixel = (2 * distance * tanV) / viewport.height;
      lookTarget.copy(DESK_CENTER).addScaledVector(cameraUp, framing.centreShiftPx * worldPerPixel);
      cameraBase.addScaledVector(cameraUp, framing.centreShiftPx * worldPerPixel);
      camera.position.copy(cameraBase);
      if (!reduced && pickup.phase === "idle") {
        if (viewport.mobile || isCoarse) {
          camera.position.addScaledVector(cameraRight, Math.sin(clock * 0.13) * 0.2);
          camera.position.addScaledVector(cameraUp, Math.sin(clock * 0.09 + 1) * 0.12);
        } else {
          camera.position.addScaledVector(cameraRight, smoothPointer.x * 0.45);
          camera.position.addScaledVector(cameraUp, smoothPointer.y * 0.25);
        }
      }
      camera.lookAt(lookTarget);
      camera.updateMatrixWorld();

      // Held artifacts sit in camera space, sized to the free part of the viewport.
      interactiveRoots.forEach((interactiveRoot, id) => {
        const basePosition = interactiveRoot.userData.basePosition as THREE.Vector3;
        const baseQuaternion = interactiveRoot.userData.baseQuaternion as THREE.Quaternion;
        const parent = interactiveRoot.parent;
        if (!parent) return;
        const isPickedUp = pickup.phase !== "idle" && pickup.targetId === id;
        const isPreviewed = pickup.phase === "idle" && activeIdRef.current === id;
        baseWorld.copy(basePosition);
        parent.localToWorld(baseWorld);
        desiredWorld.copy(baseWorld);
        desiredQuaternion.copy(baseQuaternion);
        const surface = interactiveRoot.userData.surface as ReadingSurface | undefined;
        if (isPickedUp && surface) {
          const { width, height, mobile } = viewport;
          // Bring the reading surface close enough to fill the free viewport.
          const top = mobile ? 64 : 84;
          const bottom = height - (mobile ? 70 : 84);
          const freeWidth = Math.max(width - 32, 80);
          const freeHeight = Math.max(bottom - top, 80);
          // On a portrait phone, turn landscape surfaces so their long side runs down the screen.
          const turned = surface.width > surface.height && height > width;
          screenRight.copy(turned ? surface.up : surface.right).multiplyScalar(turned ? -1 : 1);
          screenUp.copy(turned ? surface.right : surface.up);
          const spanX = turned ? surface.height : surface.width;
          const spanY = turned ? surface.width : surface.height;
          let holdDistance = Math.max(
            0.6,
            (spanX * height) / (2 * tanV * freeWidth * 0.96),
            (spanY * height) / (2 * tanV * freeHeight * 0.96),
          );
          let offsetX = 0;
          let offsetY = 0;
          if (id === "profile") {
            // Reading distance: the page spans a comfortable reading width, so
            // its own printed text is legible; scroll/drag slides it, pinch zooms.
            const reading = readingRef.current;
            // Phones read at a minimum 600px page width (pan to see the rest).
            const readingWidth = (mobile ? Math.max(width - 12, 600) : Math.min(freeWidth, 860)) * reading.zoom;
            holdDistance = Math.max(0.25, (surface.width * height) / (2 * tanV * readingWidth));
            const worldPerPx = (2 * holdDistance * tanV) / height;
            const maxScroll = Math.max(0, (surface.height / worldPerPx - freeHeight) / 2 + 16);
            const maxPan = Math.max(0, (surface.width / worldPerPx - freeWidth) / 2 + 16);
            reading.scroll = THREE.MathUtils.clamp(reading.scroll, -maxScroll, maxScroll);
            reading.panX = THREE.MathUtils.clamp(reading.panX, -maxPan, maxPan);
            offsetX = -reading.panX * worldPerPx;
            offsetY = reading.scroll * worldPerPx;
          }
          const ndcY = 1 - ((top + bottom) / height);
          holdWorld.set(offsetX, ndcY * holdDistance * tanV + offsetY, -holdDistance);
          camera.localToWorld(holdWorld);

          basisMatrix.makeBasis(screenRight, screenUp, surface.front);
          basisQuaternion.setFromRotationMatrix(basisMatrix).invert();
          worldHold.copy(camera.quaternion).multiply(basisQuaternion);
          parent.getWorldQuaternion(parentQuaternion).invert();
          holdQuaternion.copy(parentQuaternion).multiply(worldHold);

          // Put the reading surface's centre (not the pivot) on the hold point.
          centreOffset.copy(surface.centre).applyQuaternion(worldHold);
          holdWorld.sub(centreOffset);
          const arc = pickup.phase === "held" ? 0 : Math.sin(Math.PI * pickupEase);
          desiredWorld.lerp(holdWorld, pickupEase);
          desiredWorld.y += 0.6 * arc;
          desiredQuaternion.slerp(holdQuaternion, pickupEase);
        } else if (isPreviewed) {
          desiredWorld.y += 0.1;
        }
        parent.worldToLocal(desiredWorld);
        interactiveRoot.position.lerp(desiredWorld, alpha);
        interactiveRoot.quaternion.slerp(desiredQuaternion, alpha);
      });

      if (pickup.phase === "lifting") {
        pickup.progress = Math.min(1, pickup.progress + dt / 1.3);
        if (pickup.progress >= 1) pickup.phase = "held";
      } else if (pickup.phase === "returning") {
        pickup.progress = Math.min(1, pickup.progress + dt / 1.0);
        if (pickup.progress >= 1) {
          const returnedId = pickup.targetId;
          pickupRef.current = { phase: "idle", progress: 0, targetId: null };
          selectedIdRef.current = null;
          activeIdRef.current = null;
          setSelectedId(null);
          setActiveId(null);
          if (returnedId) onSelectionChangeRef.current?.(null);
          onReturnRef.current?.();
          const pending = pendingPickRef.current;
          pendingPickRef.current = null;
          if (pending) activate(pending);
        }
      }

      // Warm glow on the key whose skill is showing.
      const wantLit = decorHiddenFor === "skills" ? focusedSkillRef.current : null;
      if (wantLit !== litSkill) {
        const previous = litSkill ? skillCaps.get(litSkill) : undefined;
        if (previous) (previous.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        const next = wantLit ? skillCaps.get(wantLit) : undefined;
        if (next) (next.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
        litSkill = wantLit;
      }

      // Hide desk-only details on the held artifact, and dim its screen so the
      // blended interface defines what the display shows.
      const decorFor = pickup.phase === "held" ? pickup.targetId : null;
      if (decorFor !== decorHiddenFor) {
        if (decorHiddenFor) decorObjects.get(decorHiddenFor)?.forEach((object) => { object.visible = true; });
        if (decorFor) decorObjects.get(decorFor)?.forEach((object) => { object.visible = false; });
        const screenHeld = decorFor === "work" || decorFor === "contact";
        if (monitorMaterial) monitorMaterial.color.setScalar(decorFor === "overview" ? 0 : 1);
        screenMaterials.forEach((material) => {
          material.emissiveIntensity = screenHeld ? 0 : (material.userData.baseEmissive as number);
          material.color.copy(screenHeld ? offScreen : (material.userData.baseColor as THREE.Color));
          // Matte enough that nearby lights don't mirror as hot spots.
          material.roughness = 0.6;
        });
        decorHiddenFor = decorFor;
      }

      // Lay the content over the held artifact's reading surface. The surface
      // faces the camera, so its projected corners form a screen rectangle.
      const surfaceElement = surfaceRef.current;
      const overlaid = pickup.targetId !== "profile" && pickup.targetId !== "skills";
      const heldRoot = pickup.phase === "held" && pickup.targetId && overlaid ? interactiveRoots.get(pickup.targetId) : undefined;
      const heldSurface = heldRoot?.userData.surface as ReadingSurface | undefined;
      if (surfaceElement && heldRoot && heldSurface) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          corner.copy(heldSurface.centre)
            .addScaledVector(heldSurface.right, (sx * heldSurface.width) / 2)
            .addScaledVector(heldSurface.up, (sy * heldSurface.height) / 2);
          heldRoot.localToWorld(corner).project(camera);
          const x = (corner.x * 0.5 + 0.5) * viewport.width;
          const y = (-corner.y * 0.5 + 0.5) * viewport.height;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        surfaceElement.style.left = `${Math.round(minX)}px`;
        surfaceElement.style.top = `${Math.round(minY)}px`;
        surfaceElement.style.width = `${Math.round(maxX - minX)}px`;
        surfaceElement.style.height = `${Math.round(maxY - minY)}px`;
        if (surfaceShownFor !== pickup.targetId) {
          surfaceShownFor = pickup.targetId;
          surfaceElement.dataset.visible = "true";
        }
      } else if (surfaceElement && surfaceShownFor) {
        surfaceShownFor = null;
        surfaceElement.dataset.visible = "false";
      }

      // Lights: the lamp dims a little while an artifact is held up to you.
      const lampLevel = (introDone ? 1 : lampCurve(introSeconds)) * (1 - 0.4 * pickupEase) * lampLevelRef.current;
      lamp.intensity = LAMP_INTENSITY * lampLevel;
      bounce.intensity = 1.3 * lampLevel;
      ambient.intensity = 0.12 + 0.36 * (introDone ? 1 : lampCurve(introSeconds));
      inspectLight.intensity = 22 * pickupEase;
      if (bulbMaterial) bulbMaterial.emissiveIntensity = 7 * lampLevel;
      finish.uniforms.uStrength.value = 0.42 + 0.22 * pickupEase;
      finish.uniforms.uTime.value = reduced ? 0 : clock;

      // Ambient life (frozen for reduced motion).
      if (!reduced) {
        const flicker = 0.95 + 0.03 * Math.sin(clock * 7.3) + (Math.sin(clock * 0.7) > 0.995 ? -0.25 : 0);
        if (monitorMaterial) monitorMaterial.color.setScalar(decorHiddenFor === "overview" ? 0 : flicker);
        monitorGlow.intensity = 2.6 * flicker;
        if (notificationMaterial) notificationMaterial.emissiveIntensity = 1.1 + 0.9 * (0.5 + 0.5 * Math.sin(clock * 2.4));
        if (cursorLine && decorHiddenFor !== "work") cursorLine.visible = (clock * 1.9) % 1 < 0.55;

        for (let index = 0; index < dustCount; index += 1) {
          const seed = dustSeeds[index];
          const offset = index * 3;
          dustPositions[offset] += Math.sin(clock * 0.3 + seed) * 0.0016;
          dustPositions[offset + 1] += Math.sin(clock * 0.21 + seed * 2) * 0.0012 - 0.0006;
          dustPositions[offset + 2] += Math.cos(clock * 0.27 + seed) * 0.0016;
          if (dustPositions[offset + 1] < 1.7) spawnDust(index);
        }
        dustGeometry.attributes.position.needsUpdate = true;

        for (let index = 0; index < steamCount; index += 1) {
          const life = ((clock * 0.32) + index / steamCount) % 1;
          steamPositions[index * 3] = mugTop.x + Math.sin(life * 5 + index) * 0.08 * life;
          steamPositions[index * 3 + 1] = mugTop.y + life * 0.95;
          steamPositions[index * 3 + 2] = mugTop.z + Math.cos(life * 4 + index) * 0.05 * life;
        }
        steamGeometry.attributes.position.needsUpdate = true;
      }
      dustMaterial.opacity = 0.38 * lampLevel;
      steamMaterial.opacity = 0.09 * Math.min(1, lampLevel + 0.3);

      // Companion robot: watches whatever you hover or hold; hops when clicked.
      if (robotHead) {
        const focusId = pickup.targetId ?? activeIdRef.current;
        const focusRoot = focusId ? interactiveRoots.get(focusId) : undefined;
        robotHead.getWorldPosition(headWorld);
        let yaw = Math.sin(clock * 0.4) * 0.35;
        let pitch = 0.08;
        if (focusRoot) {
          focusRoot.getWorldPosition(lookPoint);
        } else {
          lookPoint.copy(camera.position);
        }
        if (focusRoot || !reduced) {
          const dx = lookPoint.x - headWorld.x;
          const dz = lookPoint.z - headWorld.z;
          const targetYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz), -1.3, 1.3);
          yaw = focusRoot ? targetYaw : targetYaw * 0.4 + Math.sin(clock * 0.4) * 0.3;
          pitch = THREE.MathUtils.clamp(Math.atan2(headWorld.y - lookPoint.y, Math.hypot(dx, dz)), -0.3, 0.45);
        }
        robotHead.rotation.y += (yaw - robotHead.rotation.y) * alpha;
        robotHead.rotation.x += (pitch - robotHead.rotation.x) * alpha;
        const blink = !reduced && (clock % 4.2) < 0.12 ? 0.15 : 1;
        robotEyes.forEach((eye) => {
          eye.scale.y = blink;
        });
        if (robotHopRef.current >= 0) {
          robotHopRef.current += dt / 0.55;
          const hop = robotHopRef.current;
          robotGroup.position.y = hop < 2 ? Math.abs(Math.sin(Math.PI * hop)) * 0.28 : 0;
          if (hop >= 2) robotHopRef.current = -1;
        }
      }

      // Keyboard/screen-reader anchors follow the tape labels on screen.
      hotspots.forEach((hotspot) => {
        const element = anchorRefs.current.get(hotspot.id);
        const tape = mountedModel?.getObjectByName(`hotspot-tag-${hotspot.id}`);
        if (!element || !tape) return;
        tape.getWorldPosition(anchorWorld).project(camera);
        const x = Math.round((anchorWorld.x * 0.5 + 0.5) * viewport.width);
        const y = Math.round((-anchorWorld.y * 0.5 + 0.5) * viewport.height);
        const next = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        if (anchorPositions.get(hotspot.id) !== next) {
          anchorPositions.set(hotspot.id, next);
          element.style.transform = next;
        }
      });

      composer.render(dt);
      frame = window.requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (!frame && visible) {
        lastTime = performance.now();
        frame = window.requestAnimationFrame(render);
      }
    };
    const onVisibility = () => {
      visible = !document.hidden;
      startLoop();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && !document.hidden;
      if (visible) startLoop();
      else if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { threshold: 0.05 });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(root);
    resizeObserver.observe(root);
    if (dockRef.current) resizeObserver.observe(dockRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    startLoop();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerEnd);
      root.removeEventListener("pointercancel", onPointerEnd);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onCanvasClick);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      ownedMaterials.forEach((material) => material.dispose());
      ownedTextures.forEach((texture) => texture.dispose());
      gtao?.dispose();
      bloom.dispose();
      composer.dispose();
      renderTarget.dispose();
      renderer.dispose();
    };
  }, [activate, setHotspot, skipIntro]);

  const resetCamera = useCallback(() => {
    // Reset both values so reduced-motion users get an immediate reset while
    // the regular path eases back to the authored whole-desk framing.
    zoomTargetRef.current = 1;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      zoomRef.current = 1;
    }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      audioRef.current?.setEnabled(next);
      return next;
    });
  }, []);

  const skillUse = focusedSkill ? whereUsed(focusedSkill) : [];
  const statusCopy = selectedHotspot?.id === "skills"
    ? focusedSkill
      ? `${focusedSkill}${skillUse.length ? `: used at ${skillUse.join(", ")}` : ": part of my everyday toolkit"}`
      : touchFirst ? "Tap a key to see where I used it" : "Point at a key to see where I used it"
    : selectedHotspot?.id === "profile"
    ? "Scroll to read, pinch to zoom"
    : selectedHotspot
    ? `${selectedHotspot.label} in hand · click outside to put it back`
    : activeHotspot
      ? `${activeHotspot.label} · ${activeHotspot.hint}`
      : touchFirst
        ? "Start with the resume, work or projects — tap to pick up"
        : "Start with the resume, work or projects — click to pick up";

  return (
    <div
      className={`workstation-hub midnight ${introComplete ? "intro-settled" : "intro-pending"} ${selectedId ? "is-holding" : ""}`}
      data-status={status}
      ref={rootRef}
      data-screen-label="Three-dimensional workstation hub"
    >
      <div className="workstation-stage" aria-label="Darren's desk at night, with seven objects you can pick up">
        {!introComplete && status === "ready" ? (
          <div className="workstation-intro" aria-live="polite">
            <span className="eyebrow">11:47 PM · Singapore</span>
            <strong>Switching on the lamp.</strong>
            <button type="button" onClick={skipIntro}>Skip <span aria-hidden="true">→</span></button>
          </div>
        ) : null}
        <div className="workstation-fallback" aria-hidden={status === "ready"}>
          <strong>{status === "fallback" ? "3D view unavailable" : "Loading the desk"}</strong>
          <small>Use the section list below, or open the quick resume.</small>
        </div>
        <canvas className="workstation-canvas" ref={canvasRef} aria-hidden="true" />
        {controlsOpen ? (
        <div className="workstation-camera-controls" id="view-controls" role="group" aria-label="Workstation view controls">
          <span>Scroll / pinch to zoom</span>
          <button className="workstation-reset-view" type="button" onClick={resetCamera}>
            Reset view
          </button>
          <label className="workstation-lamp-dimmer">
            Lamp
            <input
              type="range"
              min={0.3}
              max={1.6}
              step={0.05}
              value={lampLevel}
              onChange={(event) => setLampLevel(Number(event.target.value))}
              aria-valuetext={`${Math.round(lampLevel * 100)}% brightness`}
            />
          </label>
          <button className="workstation-reset-view" type="button" aria-pressed={soundOn} onClick={toggleSound}>
            Sound {soundOn ? "on" : "off"}
          </button>
          <button className="workstation-controls-hide" type="button" aria-label="Hide view controls" aria-controls="view-controls" aria-expanded="true" onClick={() => toggleControls(false)}>
            <FaXmark />
          </button>
        </div>
        ) : (
          <button className="workstation-controls-toggle" type="button" aria-label="Show view controls" aria-expanded="false" onClick={() => toggleControls(true)}>
            <FaSliders />
          </button>
        )}
        <div className="workstation-anchors" role="group" aria-label="Objects on the desk">
          {hotspots.map((hotspot) => (
            <button
              className={`workstation-anchor ${activeId === hotspot.id ? "active" : ""}`}
              key={hotspot.id}
              ref={(element) => {
                if (element) anchorRefs.current.set(hotspot.id, element);
                else anchorRefs.current.delete(hotspot.id);
              }}
              type="button"
              disabled={Boolean(selectedId) || status !== "ready"}
              aria-label={`Pick up ${hotspot.label}: ${hotspot.hint}`}
              onFocus={() => setHotspot(hotspot)}
              onBlur={() => setHotspot(null)}
              onClick={() => activate(hotspot)}
            >
              <span>{hotspot.label}</span>
              <small>{hotspot.hint}</small>
            </button>
          ))}
        </div>
        <nav className="workstation-mobile-destinations" ref={dockRef} aria-label="Desk sections">
          {hotspots.map((hotspot) => (
            <button
              disabled={Boolean(selectedId)}
              key={`dock-${hotspot.id}`}
              type="button"
              aria-label={`Pick up ${hotspot.label}: ${hotspot.hint}`}
              onClick={() => activate(hotspot)}
            >
              {hotspot.label}
            </button>
          ))}
        </nav>
        <div className="workstation-status-strip" aria-live="polite">
          <span>{statusCopy}</span>
          {selectedHotspot ? (
            <span className="workstation-status-actions">
              {selectedHotspot.id === "profile" ? (
                <a className="workstation-return-button" href="/assets/Darren_Ng_YJ_Resume.pdf" target="_blank" rel="noreferrer">Open PDF</a>
              ) : null}
              <button className="workstation-return-button" type="button" onClick={closeSelection}>Put it back <span aria-hidden="true">↩</span></button>
            </span>
          ) : <b>{activeHotspot ? "Click to pick up" : "Esc puts it back"}</b>}
        </div>
      </div>
      {/* Content laid over the held artifact's reading surface; the frame loop
          sizes and positions it to the surface's on-screen rectangle. */}
      <div
        className="workstation-surface"
        data-skin={selectedHotspot?.skin ?? "paper"}
        data-visible="false"
        ref={surfaceRef}
      >
        {selectedHotspot && selectedHotspot.node !== "profile" && selectedHotspot.node !== "skills" ? <ObjectSurface node={selectedHotspot.node} onClose={closeSelection} onOpen={openFromOverview} /> : null}
      </div>
      {/* The resume and keyboard are read on the 3D objects themselves; screen readers get the text. */}
      {selectedHotspot?.node === "profile" || selectedHotspot?.node === "skills" ? (
        <div className="visually-hidden">
          <ObjectSurface node={selectedHotspot.node} onClose={closeSelection} />
        </div>
      ) : null}
    </div>
  );
}
