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
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { renderToStaticMarkup } from "react-dom/server";
import { FaGithub, FaSliders, FaXmark } from "react-icons/fa6";
import { technologyIcon, technologyMarkFor } from "./marks";
import { ObjectSurface, skillList, whereUsed, type SurfaceNode } from "./object-surfaces";
import { resumeData, type ResumeItem } from "./resume-data";
import { site, siteUrl } from "./site";
import { createWorkstationAudio, type WorkstationAudio } from "./workstation-audio";
import { createDaylight, currentSgtHours, daylightAt, formatSgt, partOfDay, sgtDateLabel } from "./sgt-daylight";

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
  profile: ["profile-badge", "hotspot-tag-profile"],
  work: ["laptop-code-line", "hotspot-tag-work"],
  projects: ["hotspot-tag-projects"],
  skills: ["hotspot-tag-skills"],
  education: ["education-cap", "hotspot-tag-education"],
  teaching: ["teaching-pen", "hotspot-tag-teaching"],
  contact: ["hotspot-tag-contact"],
};

/**
 * Objects read on the 3D object itself, like the printed resume: what is on
 * the desk is exactly what is in the hand. Screen readers still get the text.
 */
const READ_IN_PLACE = new Set<SurfaceNode>(["profile", "skills", "teaching", "education", "projects"]);

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
 * The monitor's wallpaper: soft light fields in the desk's own palette
 * (screen aqua, lamp amber, midnight) with fine grain, and Darren's name set
 * large like a personal desktop. Ambient only; the monitor is not a pick-up object.
 */
function paintWallpaper(fontFamily: string) {
  const width = 2560;
  const height = 1070;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#060912";
  context.fillRect(0, 0, width, height);
  const field = (x: number, y: number, radius: number, colour: string) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };
  context.globalCompositeOperation = "lighter";
  field(width * 0.16, height * 1.0, width * 0.46, "rgba(45, 185, 210, 0.85)");
  field(width * 0.46, height * 0.6, width * 0.36, "rgba(40, 72, 190, 0.8)");
  field(width * 0.88, height * 0.0, width * 0.4, "rgba(255, 150, 70, 0.8)");
  field(width * 0.72, height * 0.95, width * 0.24, "rgba(150, 80, 190, 0.45)");
  // Long soft bands, like light through a window, sweeping across.
  context.globalCompositeOperation = "screen";
  for (let band = 0; band < 5; band += 1) {
    const y = height * (0.2 + band * 0.16);
    const gradient = context.createLinearGradient(0, y - 90, 0, y + 90);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    gradient.addColorStop(0.5, `rgba(180, 210, 255, ${0.035 + band * 0.01})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.save();
    context.translate(width / 2, y);
    context.rotate(-0.12 + band * 0.03);
    context.translate(-width / 2, -y);
    context.fillStyle = gradient;
    context.fillRect(-200, y - 90, width + 400, 180);
    context.restore();
  }
  context.globalCompositeOperation = "source-over";
  // Fine grain so the gradients never band.
  const grain = context.getImageData(0, 0, width, height);
  for (let index = 0; index < grain.data.length; index += 4) {
    const noise = (Math.random() - 0.5) * 10;
    grain.data[index] += noise;
    grain.data[index + 1] += noise;
    grain.data[index + 2] += noise;
  }
  context.putImageData(grain, 0, 0);

  // Who this desk belongs to, set low-left so it reads past the laptop lid.
  const left = width * 0.06;
  context.textBaseline = "alphabetic";
  context.shadowColor = "rgba(0, 0, 0, 0.35)";
  context.shadowBlur = 40;
  context.fillStyle = "#f1ece4";
  context.font = `750 300px ${fontFamily}`;
  context.fillText(site.name, left, height * 0.58);
  context.shadowBlur = 0;
  context.fillStyle = "#f2b66d";
  context.font = `650 78px ${fontFamily}`;
  context.fillText(`${site.jobTitle} · ${site.locality}`, left + 8, height * 0.7);
  context.fillStyle = "rgba(236, 231, 222, 0.85)";
  context.font = `450 56px ${fontFamily}`;
  context.fillText("Curious about building systems that stay maintainable, scale, and are fun.", left + 8, height * 0.79);
  context.fillStyle = "#6fd6e6";
  context.font = `600 52px ${fontFamily}`;
  context.fillText("Right now: building AI agents.", left + 8, height * 0.87);
  context.textAlign = "right";
  context.fillStyle = "rgba(236, 231, 222, 0.6)";
  context.font = `600 52px ${fontFamily}`;
  context.fillText(siteUrl.replace(/^https?:\/\//, ""), width - left, height * 0.12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/**
 * Fine, matte plastic grain (PBT keycaps, printed cases) as a tiling normal
 * map: random bumps, lightly blurred, turned into normals by finite differences.
 */
function paintGrainNormal(size = 256) {
  const heights = new Float32Array(size * size);
  for (let index = 0; index < heights.length; index += 1) heights[index] = Math.random();
  // Two box-blur passes soften single-pixel noise into grain.
  for (let pass = 0; pass < 2; pass += 1) {
    const copy = heights.slice();
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) sum += copy[((y + dy + size) % size) * size + ((x + dx + size) % size)];
        heights[y * size + x] = sum / 9;
      }
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  const strength = 6;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = heights[y * size + ((x + 1) % size)] - heights[y * size + ((x - 1 + size) % size)];
      const dy = heights[((y + 1) % size) * size + x] - heights[((y - 1 + size) % size) * size + x];
      const nx = -dx * strength;
      const ny = -dy * strength;
      const length = Math.hypot(nx, ny, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = (nx / length * 0.5 + 0.5) * 255;
      image.data[offset + 1] = (ny / length * 0.5 + 0.5) * 255;
      image.data[offset + 2] = (1 / length * 0.5 + 0.5) * 255;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * One handwritten notebook page: the teaching entry on blue ruling with a
 * margin. It is read on the 3D page itself, on the desk and in the hand.
 */
function paintNotebookPage(item: ResumeItem | undefined, handFamily: string) {
  const width = 820;
  const height = 984; // the page's 0.75 x 0.9 proportions
  const rule = 58;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2; // drawn at 2x so it stays sharp when held up close
  const context = canvas.getContext("2d")!;
  context.scale(2, 2);
  context.fillStyle = "#e3dccd";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgba(44, 79, 158, 0.22)";
  for (let y = rule - 2; y < height; y += rule) context.fillRect(0, y, width, 2);
  context.fillStyle = "rgba(168, 105, 42, 0.45)";
  context.fillRect(64, 0, 4, height);
  if (!item) return canvas;

  const left = 94;
  const maxWidth = width - left - 50;
  let line = 1;
  const write = (text: string, size: number, weight: number, colour: string, gapAfter = 0) => {
    context.fillStyle = colour;
    context.font = `${weight} ${size}px ${handFamily}`;
    // Wrap onto the ruling, word by word.
    let current = "";
    const flush = () => {
      context.fillText(current, left, line * rule - 12);
      line += 1;
      current = "";
    };
    text.split(" ").forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > maxWidth) flush();
      current = current ? `${current} ${word}` : word;
    });
    if (current) flush();
    line += gapAfter;
  };
  const [role, ...rest] = (item.subtitle ?? "").split(" · ");
  write(item.title, 58, 700, "#1b1d24", 1);
  write(role, 41, 700, "#1b1d24");
  write(rest.join(" · "), 41, 500, "#2c4f9e");
  write(item.period ?? "", 41, 500, "#a8692a");
  item.bullets.forEach((bullet) => write(bullet, 41, 500, "#2c4f9e"));
  return canvas;
}

/** The GitHub mark as a canvas path, taken from the site's own icon set. */
const githubMark = (() => {
  if (typeof document === "undefined") return null;
  const svg = renderToStaticMarkup(<FaGithub />);
  const path = /\sd="([^"]+)"/.exec(svg)?.[1];
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1].split(" ").map(Number);
  return path && viewBox ? { path: new Path2D(path), width: viewBox[2], height: viewBox[3] } : null;
})();

/** Where the repo link sits on a project brief, in 0–1 texture coordinates. */
type LinkArea = { href: string; u0: number; v0: number; u1: number; v1: number };

/**
 * One printed project brief on the folder's top sheet, laid out like a case
 * study: header, title and stack line, a metric card and overview on the left,
 * numbered "what I built" on the right, stack tags and the repo link in the
 * footer, and a folded corner that says the page turns. Text shrinks to fit,
 * so nothing ever collides. Returns where the repo link was printed.
 */
function paintProjectSheet(canvas: HTMLCanvasElement, item: ResumeItem, page: number, total: number, fontFamily: string): LinkArea | null {
  const width = 1378;
  const height = 1000;
  const margin = 96;
  const ink = "#1b1d24";
  const body = "#33363f";
  const muted = "#6b6f78";
  const accent = "#1f3b7a";
  const warm = "#a8692a";
  const context = canvas.getContext("2d")!;
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.fillStyle = "#f4efe5";
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < 1200; index += 1) {
    context.fillStyle = `rgba(90, 70, 40, ${Math.random() * 0.04})`;
    context.fillRect(Math.random() * width, Math.random() * height, 2, 2);
  }
  context.textBaseline = "alphabetic";
  const font = (weight: number, size: number) => `${weight} ${size}px ${fontFamily}`;
  const lines = (text: string, size: number, weight: number, columnWidth: number) => {
    context.font = font(weight, size);
    const out: string[] = [];
    let current = "";
    text.split(" ").forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > columnWidth) {
        out.push(current);
        current = word;
      } else current = next;
    });
    if (current) out.push(current);
    return out;
  };
  const draw = (text: string, x: number, y: number, size: number, weight: number, colour: string, align: CanvasTextAlign = "left") => {
    context.font = font(weight, size);
    context.fillStyle = colour;
    context.textAlign = align;
    context.fillText(text, x, y);
    context.textAlign = "left";
  };

  // Header.
  draw("PROJECTS", margin, 92, 20, 700, warm);
  context.font = font(700, 20);
  draw(`${String(page + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, margin + context.measureText("PROJECTS").width + 18, 92, 20, 600, muted);
  draw(item.period ?? "", width - margin, 92, 22, 600, muted, "right");
  context.fillStyle = "rgba(27, 29, 36, 0.14)";
  context.fillRect(margin, 112, width - margin * 2, 2);

  // Title and stack line, full width.
  let titleSize = 54;
  let titleLines = lines(item.title, titleSize, 750, width - margin * 2);
  while (titleLines.length > 2 && titleSize > 36) titleLines = lines(item.title, (titleSize -= 2), 750, width - margin * 2);
  let y = 184;
  titleLines.forEach((text) => {
    draw(text, margin, y, titleSize, 750, ink);
    y += titleSize * 1.12;
  });
  const bodyTop = y + 20;
  const bodyBottom = height - 190;

  // Left column: metric card, then overview.
  const leftX = margin;
  const leftWidth = 520;
  let leftY = bodyTop;
  if (item.highlight) {
    const labelLines = lines(item.highlight.label, 24, 500, leftWidth - 64);
    const cardHeight = 150 + labelLines.length * 32;
    context.fillStyle = "rgba(31, 59, 122, 0.07)";
    context.fillRect(leftX, leftY, leftWidth, cardHeight);
    context.fillStyle = accent;
    context.fillRect(leftX, leftY, 6, cardHeight);
    context.font = font(800, 84);
    const valueSize = Math.min(84, Math.floor(84 * (leftWidth - 64) / context.measureText(item.highlight.value).width));
    draw(item.highlight.value, leftX + 32, leftY + 104, valueSize, 800, accent);
    labelLines.forEach((text, index) => draw(text, leftX + 32, leftY + 146 + index * 32, 24, 500, body));
    leftY += cardHeight + 46;
  }
  if (item.showcase?.summary) {
    draw("OVERVIEW", leftX, leftY, 18, 700, warm);
    let size = 26;
    let summary = lines(item.showcase.summary, size, 450, leftWidth);
    while (leftY + 40 + summary.length * size * 1.45 > bodyBottom && size > 18) summary = lines(item.showcase.summary, (size -= 1), 450, leftWidth);
    summary.forEach((text, index) => draw(text, leftX, leftY + 44 + index * size * 1.45, size, 450, body));
  }

  // Right column: what was built, numbered.
  const rightX = 680;
  const rightWidth = width - margin - rightX;
  context.fillStyle = "rgba(27, 29, 36, 0.1)";
  context.fillRect(rightX - 44, bodyTop, 2, bodyBottom - bodyTop);
  draw("WHAT I BUILT", rightX, bodyTop + 18, 18, 700, warm);
  let size = 25;
  const measure = (fontSize: number) => item.bullets.reduce((total, bullet) => total + lines(bullet, fontSize, 450, rightWidth - 56).length * fontSize * 1.45 + 26, 0);
  while (bodyTop + 56 + measure(size) > bodyBottom && size > 17) size -= 1;
  let rightY = bodyTop + 62;
  item.bullets.forEach((bullet, index) => {
    draw(String(index + 1).padStart(2, "0"), rightX, rightY, size - 2, 700, warm);
    lines(bullet, size, 450, rightWidth - 56).forEach((text) => {
      draw(text, rightX + 56, rightY, size, 450, body);
      rightY += size * 1.45;
    });
    rightY += 26;
  });

  // Footer: the repo link right-aligned, stack tags filling the space before it.
  context.fillStyle = "rgba(27, 29, 36, 0.14)";
  context.fillRect(margin, height - 150, width - margin * 2, 2);
  const tagY = height - 108;
  let link: LinkArea | null = null;
  let tagLimit = width - margin;
  if (item.repo) {
    const label = item.repo.replace(/^https?:\/\//, "");
    let linkSize = 22;
    context.font = font(650, linkSize);
    while (context.measureText(label).width > 500 && linkSize > 16) context.font = font(650, (linkSize -= 1));
    const labelWidth = context.measureText(label).width;
    const right = width - 150; // clear of the folded corner

    const left = right - labelWidth - 38;
    // The GitHub mark, then the address, underlined like a link.
    context.fillStyle = ink;
    if (githubMark) {
      context.save();
      context.translate(left, tagY - 22);
      context.scale(28 / githubMark.height, 28 / githubMark.height);
      context.fill(githubMark.path);
      context.restore();
    }
    draw(label, left + 38, tagY, linkSize, 650, accent);
    context.fillStyle = accent;
    context.fillRect(left + 38, tagY + 6, labelWidth, 2);
    link = { href: item.repo, u0: (left - 10) / width, v0: (tagY - 34) / height, u1: (right + 10) / width, v1: (tagY + 16) / height };
    tagLimit = left - 32;
  }
  const tags = item.stack ?? [];
  let tagX = margin;
  context.font = font(600, 19);
  const chip = (text: string) => {
    const tagWidth = context.measureText(text).width + 28;
    context.strokeStyle = "rgba(27, 29, 36, 0.35)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.roundRect(tagX, tagY - 24, tagWidth, 36, 18);
    context.stroke();
    draw(text, tagX + 14, tagY, 19, 600, body);
    context.font = font(600, 19);
    tagX += tagWidth + 10;
  };
  for (let index = 0; index < tags.length; index += 1) {
    const remaining = tags.length - index;
    const nextWidth = context.measureText(tags[index]).width + 38;
    const moreWidth = remaining > 1 ? context.measureText(`+${remaining - 1}`).width + 38 : 0;
    if (tagX + nextWidth + moreWidth > tagLimit) {
      chip(`+${remaining}`);
      break;
    }
    chip(tags[index]);
  }

  // Folded corner: the page lifts at the bottom right, so it reads as turnable.
  const fold = 118;
  context.fillStyle = "#cfc6b4"; // the next sheet showing beneath
  context.beginPath();
  context.moveTo(width - fold, height);
  context.lineTo(width, height - fold);
  context.lineTo(width, height);
  context.closePath();
  context.fill();
  const flap = context.createLinearGradient(width - fold, height - fold, width - fold / 2, height - fold / 2);
  flap.addColorStop(0, "#e6dfd0");
  flap.addColorStop(1, "#fbf7ef");
  context.fillStyle = flap;
  context.beginPath();
  context.moveTo(width - fold, height);
  context.lineTo(width, height - fold);
  context.lineTo(width - fold, height - fold);
  context.closePath();
  context.shadowColor = "rgba(0, 0, 0, 0.22)";
  context.shadowBlur = 22;
  context.shadowOffsetX = -6;
  context.shadowOffsetY = -6;
  context.fill();
  context.shadowColor = "transparent";
  context.setTransform(1, 0, 0, 1, 0, 0);
  return link;
}

/**
 * The Corne's reflective (Sharp MiP) displays: black pixels on grey. Left
 * half: battery, Bluetooth and the active layer; right half: a small mountain
 * scene, like Darren's own boards.
 */
function paintKeyboardDisplay(side: "left" | "right", fontFamily: string) {
  const width = 200;
  const height = 536;
  // Sharp memory LCDs are low resolution: draw at ~68 x 182 real pixels and
  // show them unsmoothed, so the panel reads as a real tiny display.
  const canvas = document.createElement("canvas");
  canvas.width = 68;
  canvas.height = 182;
  const context = canvas.getContext("2d")!;
  context.scale(canvas.width / width, canvas.height / height);
  context.fillStyle = "#c9ccc4";
  context.fillRect(0, 0, width, height);
  context.translate(0, (height - 460) / 2); // the layout below is drawn for 460 tall
  context.fillStyle = "#15171a";
  context.strokeStyle = "#15171a";
  context.lineWidth = 6;
  // Battery and a status glyph along the top.
  context.strokeRect(18, 22, 56, 26);
  context.fillRect(76, 30, 6, 10);
  context.fillRect(24, 28, 34, 14);
  if (side === "left") {
    context.beginPath();
    context.arc(width - 40, 36, 14, 0, Math.PI * 2);
    context.stroke();
    context.strokeRect(18, 78, width - 36, 92);
    context.beginPath();
    context.moveTo(30, 158);
    context.lineTo(width - 50, 150);
    context.lineTo(width - 40, 92);
    context.stroke();
    context.font = `700 44px ${fontFamily}`;
    context.textAlign = "center";
    [["1", 52, 240], ["2", 148, 240], ["3", 100, 300], ["4", 52, 360], ["5", 148, 360]].forEach(([label, x, y], index) => {
      if (index === 0) {
        context.beginPath();
        context.arc(x as number, (y as number) - 15, 26, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#c9ccc4";
        context.fillText(label as string, x as number, y as number);
        context.fillStyle = "#15171a";
      } else context.fillText(label as string, x as number, y as number);
    });
    context.font = `700 30px ${fontFamily}`;
    context.fillText("QWERTY", width / 2, 430);
  } else {
    // Wi-Fi arcs, then a framed mountain at night.
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.arc(width - 40, 48, 8 + ring * 9, Math.PI * 1.2, Math.PI * 1.8);
      context.stroke();
    }
    context.strokeRect(18, 78, width - 36, height - 100);
    context.beginPath();
    context.moveTo(24, 400);
    context.lineTo(100, 150);
    context.lineTo(176, 400);
    context.fill();
    context.fillStyle = "#c9ccc4";
    context.beginPath();
    context.moveTo(100, 150);
    context.lineTo(78, 222);
    context.lineTo(100, 205);
    context.lineTo(122, 222);
    context.fill();
    context.fillStyle = "#15171a";
    for (let tree = 0; tree < 6; tree += 1) {
      const x = 30 + tree * 28;
      context.beginPath();
      context.moveTo(x, 430);
      context.lineTo(x + 13, 360 + (tree % 2) * 18);
      context.lineTo(x + 26, 430);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * An honours certificate printed from one education entry (Dean's List,
 * Director's List). Text keeps to the left: the cap rests on the top-right
 * corner and the 3D wax seal sits bottom right. Deliberately no crest or
 * signature. Read on the 3D sheet itself, so it is drawn at 2x.
 */
function paintCertificate(item: ResumeItem, displayFamily: string, handFamily: string) {
  const width = 1400;
  const height = 1000;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d")!;
  context.scale(2, 2);
  context.fillStyle = "#f3eee3";
  context.fillRect(0, 0, width, height);
  // Double rule border in deep ink green.
  context.strokeStyle = "#24493f";
  context.lineWidth = 10;
  context.strokeRect(46, 46, width - 92, height - 92);
  context.lineWidth = 3;
  context.strokeRect(70, 70, width - 140, height - 140);

  const honour = item.bullets.find((line) => / list/i.test(line)) ?? item.bullets.at(-1) ?? "";
  const [awardName, awardPeriod] = honour.split(" · ");
  const left = 130;
  const maxWidth = 760;
  const line = (text: string, y: number, weight: number, size: number, family: string, colour: string) => {
    if (!text) return;
    context.fillStyle = colour;
    context.font = `${weight} ${size}px ${family}`;
    const fitted = Math.min(size, Math.floor(size * maxWidth / context.measureText(text).width));
    context.font = `${weight} ${fitted}px ${family}`;
    context.fillText(text, left, y);
  };
  context.textBaseline = "alphabetic";
  line("CERTIFICATE OF ACHIEVEMENT", 190, 700, 34, displayFamily, "#24493f");
  line(awardName, 330, 750, 132, displayFamily, "#1b1d24");
  line(awardPeriod ?? "", 400, 500, 42, displayFamily, "#3b3f4a");
  line("Awarded to", 500, 500, 34, displayFamily, "#6b6f78");
  line(resumeData.profile.items[0]?.title ?? "Darren Ng Yijie", 590, 700, 92, handFamily, "#2c4f9e");
  line(item.subtitle?.split(" · ")[0] ?? "", 670, 600, 36, displayFamily, "#3b3f4a");
  line(item.title, 718, 500, 34, displayFamily, "#3b3f4a");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

/**
 * The phone's lock screen in Singapore time: wallpaper, date, clock and one
 * notification. Repainted onto the same canvas when the minute changes.
 */
function paintPhoneScreen(canvas: HTMLCanvasElement, fontFamily: string, hours: number) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext("2d")!;
  // Every line shrinks to fit its box, so nothing runs off the glass.
  const fitText = (text: string, x: number, y: number, weight: number, size: number, maxWidth: number) => {
    context.font = `${weight} ${size}px ${fontFamily}`;
    const fitted = Math.min(size, Math.floor(size * maxWidth / context.measureText(text).width));
    context.font = `${weight} ${fitted}px ${fontFamily}`;
    context.fillText(text, x, y);
  };
  const wallpaper = context.createLinearGradient(0, 0, width * 0.4, height);
  wallpaper.addColorStop(0, "#0b1424");
  wallpaper.addColorStop(0.55, "#101a2c");
  wallpaper.addColorStop(1, "#2a1a0c");
  context.fillStyle = wallpaper;
  context.fillRect(0, 0, width, height);
  const lampGlow = context.createRadialGradient(width * 0.2, height * 1.02, 0, width * 0.2, height * 1.02, height * 0.65);
  lampGlow.addColorStop(0, "rgba(242, 182, 109, 0.45)");
  lampGlow.addColorStop(1, "rgba(242, 182, 109, 0)");
  context.fillStyle = lampGlow;
  context.fillRect(0, 0, width, height);
  const screenGlow = context.createRadialGradient(width * 0.85, height * 0.05, 0, width * 0.85, height * 0.05, height * 0.5);
  screenGlow.addColorStop(0, "rgba(111, 214, 230, 0.22)");
  screenGlow.addColorStop(1, "rgba(111, 214, 230, 0)");
  context.fillStyle = screenGlow;
  context.fillRect(0, 0, width, height);

  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillStyle = "rgba(236, 231, 222, 0.82)";
  fitText(sgtDateLabel(), width / 2, height * 0.165, 600, 52, width * 0.8);
  context.fillStyle = "#ece7de";
  fitText(formatSgt(hours).replace(/ [AP]M$/, ""), width / 2, height * 0.31, 750, 250, width * 0.84);

  // One notification card: what picking the phone up gets you.
  const left = width * 0.06;
  const top = height * 0.52;
  const cardWidth = width * 0.88;
  const cardHeight = 230;
  context.fillStyle = "rgba(236, 231, 222, 0.14)";
  context.beginPath();
  context.roundRect(left, top, cardWidth, cardHeight, 46);
  context.fill();
  context.fillStyle = "#f2b66d";
  context.beginPath();
  context.roundRect(left + 34, top + 40, 96, 96, 24);
  context.fill();
  context.fillStyle = "#1d1407";
  fitText("DN", left + 82, top + 104, 750, 44, 80);
  const textLeft = left + 160;
  const textWidth = cardWidth - 160 - 40;
  context.textAlign = "right";
  context.fillStyle = "rgba(236, 231, 222, 0.62)";
  fitText("now", left + cardWidth - 36, top + 80, 500, 34, 80);
  context.textAlign = "left";
  context.fillStyle = "#ece7de";
  fitText("Darren Ng", textLeft, top + 82, 700, 44, textWidth - 100);
  context.fillStyle = "rgba(236, 231, 222, 0.88)";
  fitText("Open to SWE roles.", textLeft, top + 136, 500, 38, textWidth);
  fitText("Pick me up to say hi.", textLeft, top + 184, 500, 38, textWidth);

  context.fillStyle = "rgba(236, 231, 222, 0.75)";
  context.beginPath();
  context.roundRect(width / 2 - 140, height - 56, 280, 12, 6);
  context.fill();
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
  // Turns the held project brief (set by the scene once the folder exists).
  const turnProjectRef = useRef<((step: number) => void) | null>(null);
  // Swaps which certificate is on top (set by the scene).
  const turnCertificateRef = useRef<(() => void) | null>(null);
  // Singapore time drives the window light; null until mounted so SSR and the
  // first client render agree.
  const [sgtHour, setSgtHour] = useState<number | null>(null);
  const sgtHourRef = useRef(0);

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
    const tick = () => {
      const hour = currentSgtHours();
      sgtHourRef.current = hour;
      setSgtHour(hour);
    };
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

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
      if (selectedIdRef.current === "education" && pickupRef.current.phase === "held" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        turnCertificateRef.current?.();
        return;
      }
      if (selectedIdRef.current === "projects" && pickupRef.current.phase === "held" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        turnProjectRef.current?.(event.key === "ArrowRight" ? 1 : -1);
        return;
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
    const daylight = daylightAt(sgtHourRef.current, createDaylight());
    const airColor = daylight.air.clone();
    scene.background = airColor;
    const fog = new THREE.FogExp2(airColor, 0.022);
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

    // Lighting: one warm lamp pool, sun or moon from the window (by SGT), screen spill.
    const ambient = new THREE.HemisphereLight(daylight.sky, daylight.ground, daylight.fill);
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
    const windowLight = new THREE.DirectionalLight(daylight.light, daylight.intensity);
    windowLight.position.copy(daylight.position);
    scene.add(windowLight);
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
    // The desk GLB is meshopt-compressed by `npm run optimize:desk`.
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const textureLoader = new THREE.TextureLoader();
    const modelRoot = new THREE.Group();
    scene.add(modelRoot);
    const interactiveRoots = new Map<string, THREE.Object3D>();
    const ownedTextures = new Set<THREE.Texture>();
    const ownedMaterials = new Set<THREE.Material>();
    let mountedModel: THREE.Object3D | null = null;
    let monitorMaterial: THREE.MeshBasicMaterial | null = null;
    let bulbMaterial: THREE.MeshStandardMaterial | null = null;
    // Lock screen in Singapore time, repainted when the minute changes.
    const phoneCanvas = document.createElement("canvas");
    phoneCanvas.width = 840;
    phoneCanvas.height = 1800;
    const phoneTexture = new THREE.CanvasTexture(phoneCanvas);
    phoneTexture.colorSpace = THREE.SRGBColorSpace;
    phoneTexture.flipY = false;
    phoneTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    ownedTextures.add(phoneTexture);
    let phoneFont = "sans-serif";
    /**
     * Page turns: a segmented copy of the sheet carrying the old page curls up
     * and over its top edge (the far edge bends more than the hinge, so it
     * reads as paper), while the new page already waits underneath.
     */
    type Flip = { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; front: THREE.MeshStandardMaterial; back: THREE.MeshStandardMaterial; texture: THREE.Texture; t: number; width: number; depth: number; topZ: number; minX: number };
    const flips: Flip[] = [];
    const FLIP_SECONDS = 0.75;
    const FLIP_ROWS = 28;
    const startFlip = (sheet: THREE.Mesh, oldImage: HTMLCanvasElement | THREE.Texture) => {
      if (reduced) return;
      const geometrySource = sheet.geometry;
      geometrySource.computeBoundingBox();
      const box = geometrySource.boundingBox!;
      // The hinge is the sheet's printed top edge: the end where uv.y is 0.
      const uv = geometrySource.getAttribute("uv");
      const position = geometrySource.getAttribute("position");
      let topZ = box.min.z;
      if (uv && position) {
        let best = Infinity;
        for (let index = 0; index < uv.count; index += 1) {
          if (uv.getY(index) < best) {
            best = uv.getY(index);
            topZ = position.getZ(index);
          }
        }
      }
      const texture = oldImage instanceof THREE.Texture ? oldImage : new THREE.CanvasTexture(oldImage);
      if (!(oldImage instanceof THREE.Texture)) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
      }
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array((FLIP_ROWS + 1) * 2 * 3);
      const uvs = new Float32Array((FLIP_ROWS + 1) * 2 * 2);
      const indices: number[] = [];
      for (let row = 0; row <= FLIP_ROWS; row += 1) {
        const v = row / FLIP_ROWS;
        uvs.set([0, v, 1, v], row * 4);
        if (row < FLIP_ROWS) {
          const a = row * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      const sourceMaterial = sheet.material as THREE.MeshStandardMaterial;
      // Printed front, plain paper back.
      const front = new THREE.MeshStandardMaterial({ map: texture, color: sourceMaterial.color, roughness: 0.9, side: THREE.FrontSide });
      const back = new THREE.MeshStandardMaterial({ color: "#c9c1b2", roughness: 0.92, side: THREE.BackSide });
      const mesh = new THREE.Mesh(geometry, front);
      const backMesh = new THREE.Mesh(geometry, back);
      mesh.add(backMesh);
      mesh.renderOrder = 2;
      sheet.add(mesh);
      const flip: Flip = { mesh, geometry, front, back, texture, t: 0, width: box.max.x - box.min.x, depth: box.max.z - box.min.z, topZ, minX: box.min.x };
      flips.push(flip);
      layFlip(flip, 0);
    };
    const layFlip = (flip: Flip, progress: number) => {
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const turn = Math.PI * eased;
      const direction = flip.topZ < 0 ? 1 : -1; // from the hinge toward the bottom edge
      const segment = flip.depth / FLIP_ROWS;
      const attribute = flip.geometry.getAttribute("position") as THREE.BufferAttribute;
      let y = 0.0015;
      let z = flip.topZ;
      for (let row = 0; row <= FLIP_ROWS; row += 1) {
        attribute.setXYZ(row * 2, flip.minX, y, z);
        attribute.setXYZ(row * 2 + 1, flip.minX + flip.width, y, z);
        const angle = turn * (0.55 + 0.45 * (row / FLIP_ROWS)) * Math.min(1, 0.35 + progress * 2);
        z += direction * segment * Math.cos(angle);
        y += segment * Math.sin(angle);
      }
      attribute.needsUpdate = true;
      flip.geometry.computeVertexNormals();
      flip.geometry.computeBoundingSphere();
    };
    const tickFlips = (dt: number) => {
      for (let index = flips.length - 1; index >= 0; index -= 1) {
        const flip = flips[index];
        flip.t += dt / FLIP_SECONDS;
        if (flip.t >= 1) {
          flip.mesh.removeFromParent();
          flip.geometry.dispose();
          flip.front.dispose();
          flip.back.dispose();
          if (!ownedTextures.has(flip.texture)) flip.texture.dispose();
          flips.splice(index, 1);
        } else layFlip(flip, flip.t);
      }
    };

    /**
     * Certificate swap: the two sheets trade places like papers on a desk. The
     * top one slides out to the right and tucks in behind; the one beneath
     * slides out to the left, rises and settles on top. Proxies carry the
     * prints while the real sheets (and the seal) wait hidden.
     */
    type SwapSheet = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; fromQ: THREE.Quaternion; toQ: THREE.Quaternion; lateral: THREE.Vector3; lift: THREE.Vector3 };
    let swap: { t: number; sheets: SwapSheet[]; hidden: THREE.Object3D[]; done: () => void } | null = null;
    const SWAP_SECONDS = 0.85;
    const startSwap = (top: THREE.Mesh, under: THREE.Mesh, topMap: THREE.Texture, underMap: THREE.Texture, hidden: THREE.Object3D[], done: () => void) => {
      if (swap) return;
      if (reduced) {
        done();
        return;
      }
      const sheetFor = (face: THREE.Mesh, map: THREE.Texture, toFace: THREE.Mesh, side: number, rise: number): SwapSheet => {
        const material = new THREE.MeshStandardMaterial({ map, color: (face.material as THREE.MeshStandardMaterial).color, roughness: 0.9, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(face.geometry, material);
        mesh.scale.copy(face.scale);
        face.parent!.add(mesh);
        face.geometry.computeBoundingBox();
        const width = (face.geometry.boundingBox!.max.x - face.geometry.boundingBox!.min.x) * face.scale.x;
        return {
          mesh,
          from: face.position.clone(),
          to: toFace.position.clone(),
          fromQ: face.quaternion.clone(),
          toQ: toFace.quaternion.clone(),
          lateral: new THREE.Vector3(1, 0, 0).applyQuaternion(face.quaternion).multiplyScalar(width * 0.3 * side),
          lift: new THREE.Vector3(0, 1, 0).applyQuaternion(face.quaternion).multiplyScalar(rise),
        };
      };
      hidden.forEach((object) => { object.visible = false; });
      swap = {
        t: 0,
        // Going behind: out to the right and back. Coming forward: out to the left and toward you.
        sheets: [sheetFor(top, topMap, under, 1, -0.1), sheetFor(under, underMap, top, -1, 0.06)],
        hidden,
        done,
      };
      layoutSwap(0);
    };
    const layoutSwap = (progress: number) => {
      if (!swap) return;
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      const arc = Math.sin(Math.PI * progress);
      swap.sheets.forEach((sheet) => {
        sheet.mesh.position.lerpVectors(sheet.from, sheet.to, eased).addScaledVector(sheet.lateral, arc).addScaledVector(sheet.lift, arc);
        sheet.mesh.quaternion.slerpQuaternions(sheet.fromQ, sheet.toQ, eased);
      });
    };
    const tickSwap = (dt: number) => {
      if (!swap) return;
      swap.t += dt / SWAP_SECONDS;
      if (swap.t < 1) {
        layoutSwap(swap.t);
        return;
      }
      swap.sheets.forEach((sheet) => {
        sheet.mesh.removeFromParent();
        (sheet.mesh.material as THREE.Material).dispose();
      });
      swap.hidden.forEach((object) => { object.visible = true; });
      const finish = swap.done;
      swap = null;
      finish();
    };

    // The repo link printed on the current project brief, and that sheet's mesh.
    let projectLink: LinkArea | null = null;
    let briefMesh: THREE.Mesh | null = null;
    let phoneMinute = -1;
    let paneMaterial: THREE.MeshStandardMaterial | null = null;
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
            // The lamp sits behind the monitor's left side; its shadow would
            // fall across the resume, so the monitor casts none. The lamp's
            // light sits inside its own head, so its body casts none either.
            object.castShadow = !/^(room-|overview-monitor|monitor-portfolio-screen|desk-lamp)/.test(object.name);
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
          ownMaterial(tape, new THREE.MeshStandardMaterial({ map: texture, color: "#d9d2c6", alphaTest: 0.5, roughness: 0.92, side: THREE.DoubleSide }));
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

        // Paper grain on every authored sheet. Scanned paper in the downloaded
        // notebook and folder is near pure white, so it is toned to the same
        // warm off-white and never clips under the lamp.
        const paperGrain = paintPaper(false);
        paperGrain.anisotropy = renderer.capabilities.getMaxAnisotropy();
        ownedTextures.add(paperGrain);
        const paperMaterials = new Set<THREE.MeshStandardMaterial>();
        const scannedPaper = new Set<THREE.MeshStandardMaterial>();
        mountedModel.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
          const name = object.material.name;
          if (name === "Warm Paper") paperMaterials.add(object.material);
          else if (/^(M_Paper|M_Pages|A4_)/.test(name)) scannedPaper.add(object.material);
        });
        paperMaterials.forEach((material) => {
          material.map = paperGrain;
          // Sheets sit right under the lamp; keep them below clipping in daylight too.
          material.color.multiplyScalar(0.82);
          material.roughness = 0.92;
          material.needsUpdate = true;
        });
        // Room surfaces carry real plaster and concrete texture; tint them down
        // to midnight so the desk stays the brightest thing in the frame.
        mountedModel.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
          if (object.material.name === "Midnight Plaster") object.material.color.set("#1e2534");
          if (object.material.name === "Midnight Floor") object.material.color.set("#080a0e");
          // The veneer scan is a light walnut; deepen it toward the real desk.
          if (object.material.name === "Walnut Desk") object.material.color.set("#c4a084");
        });
        scannedPaper.forEach((material) => {
          material.color.set("#c9c2b6");
          material.roughness = Math.max(material.roughness, 0.85);
        });
        // Handwritten teaching notes on the notebook's two pages.
        (["left", "right"] as const).forEach((side, index) => {
          const page = mountedModel!.getObjectByName(`notebook-notes-${side}`);
          if (!(page instanceof THREE.Mesh)) return;
          const texture = new THREE.CanvasTexture(paintNotebookPage(resumeData.teaching.items[index], tapeFont));
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(texture);
          ownMaterial(page, new THREE.MeshStandardMaterial({ map: texture, color: "#d4cdc0", roughness: 0.9 }));
        });

        // PBT keycaps and a printed case: fine matte grain instead of smooth plastic.
        const grain = paintGrainNormal();
        ownedTextures.add(grain);
        const grainy = new Set<THREE.MeshStandardMaterial>();
        mountedModel.traverse((object) => {
          if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
          if (/^(keyboard-key|keyboard-thumb-key|keyboard-legend|keyboard-half|hotspot-skills-keyboard|keyboard-display-bezel)/.test(object.name)) grainy.add(object.material);
        });
        grainy.forEach((material) => {
          // Fine and subtle: PBT caps a little coarser than the printed case,
          // and the printed legend tops barely textured.
          const casing = material.name === "Keyboard Base";
          const legend = Boolean(material.map) && !casing;
          material.normalMap = grain.clone();
          material.normalMap.repeat.setScalar(casing ? 9 : 7);
          material.normalScale.setScalar(casing ? 0.22 : legend ? 0.14 : 0.28);
          material.roughness = Math.max(material.roughness, casing ? 0.62 : 0.7);
          material.needsUpdate = true;
          ownedTextures.add(material.normalMap);
        });

        // The project brief on the folder: one sheet per project, turned in the hand.
        const brief = mountedModel.getObjectByName("projects-brief");
        if (brief instanceof THREE.Mesh) {
          briefMesh = brief;
          const projects = resumeData.projects.items;
          const briefFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
          const briefCanvas = document.createElement("canvas");
          briefCanvas.width = 2756;
          briefCanvas.height = 2000;
          const briefTexture = new THREE.CanvasTexture(briefCanvas);
          briefTexture.colorSpace = THREE.SRGBColorSpace;
          briefTexture.flipY = false;
          briefTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(briefTexture);
          let page = 0;
          const paintPage = () => {
            projectLink = paintProjectSheet(briefCanvas, projects[page], page, projects.length, briefFamily);
            briefTexture.needsUpdate = true;
          };
          paintPage();
          ownMaterial(brief, new THREE.MeshStandardMaterial({ map: briefTexture, color: "#d4cdc0", roughness: 0.9 }));
          turnProjectRef.current = (step) => {
            // Snapshot the page being turned, then print the next one underneath.
            const snapshot = document.createElement("canvas");
            snapshot.width = briefCanvas.width / 2;
            snapshot.height = briefCanvas.height / 2;
            snapshot.getContext("2d")!.drawImage(briefCanvas, 0, 0, snapshot.width, snapshot.height);
            page = (page + step + projects.length) % projects.length;
            paintPage();
            startFlip(brief, snapshot);
            audioRef.current?.rustle();
          };
        }

        // The Corne's two displays.
        (["left", "right"] as const).forEach((side) => {
          const panel = mountedModel!.getObjectByName(`keyboard-display-${side}`);
          if (!(panel instanceof THREE.Mesh)) return;
          const texture = paintKeyboardDisplay(side, getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif");
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(texture);
          // Reflective panel: lit by the room, with a faint front light for night.
          ownMaterial(panel, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, emissive: "#ffffff", emissiveMap: texture, emissiveIntensity: 0.12 }));
        });

        // One certificate per school: SMU on top, Nanyang Poly beneath it.
        const certificateFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "serif";
        const certificateFaces: THREE.MeshStandardMaterial[] = [];
        const certificateTextures: THREE.Texture[] = [];
        resumeData.education.items.forEach((item, index) => {
          const face = mountedModel!.getObjectByName(index === 0 ? "education-certificate-face" : `education-certificate-face-${index + 1}`);
          if (!(face instanceof THREE.Mesh)) return;
          const texture = paintCertificate(item, certificateFamily, tapeFont);
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          ownedTextures.add(texture);
          certificateTextures.push(texture);
          // Off-white like the resume, so the lamp never clips the sheet.
          certificateFaces.push(ownMaterial(face, new THREE.MeshStandardMaterial({ map: texture, color: "#d4cdc0", roughness: 0.9 })));
        });
        // In the hand, a click brings the certificate underneath to the top.
        const topCertificate = mountedModel.getObjectByName("education-certificate-face");
        const underCertificate = mountedModel.getObjectByName("education-certificate-face-2");
        const educationRoot = interactiveRoots.get("education");
        turnCertificateRef.current = () => {
          if (certificateFaces.length < 2 || !(topCertificate instanceof THREE.Mesh) || !(underCertificate instanceof THREE.Mesh)) return;
          // The sheets, their prints and the seal hide while the proxies move.
          const hidden: THREE.Object3D[] = [];
          educationRoot?.traverse((object) => {
            if (object !== educationRoot && /^education-(certificate|seal)/.test(object.name) && object.visible) hidden.push(object);
          });
          startSwap(topCertificate, underCertificate, certificateTextures[0], certificateTextures[1], hidden, () => {
            certificateTextures.push(certificateTextures.shift()!);
            certificateFaces.forEach((material, index) => {
              material.map = certificateTextures[index];
              material.needsUpdate = true;
            });
          });
          audioRef.current?.rustle();
        };
        const shade = mountedModel.getObjectByName("desk-lamp-shade");
        if (shade) shade.getWorldPosition(lamp.position);
        const bulb = mountedModel.getObjectByName("desk-lamp-bulb");
        if (bulb instanceof THREE.Mesh) {
          bulbMaterial = ownMaterial(bulb, new THREE.MeshStandardMaterial({ color: "#ffe2b0", emissive: "#ffb867", emissiveIntensity: 0 }));
          bulb.castShadow = false;
        }
        const pane = mountedModel.getObjectByName("room-window-sky");
        if (pane instanceof THREE.Mesh && pane.material instanceof THREE.MeshStandardMaterial) {
          paneMaterial = ownMaterial(pane, pane.material.clone());
          paneMaterial.emissive.copy(daylight.pane);
          paneMaterial.emissiveIntensity = daylight.paneStrength;
        }
        const phoneScreen = mountedModel.getObjectByName("contact-phone-screen");
        if (phoneScreen instanceof THREE.Mesh) {
          phoneFont = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
          phoneMinute = -1; // repaint with the display font, now that it has loaded
          // The source's screen normals point into the phone: draw both sides.
          ownMaterial(phoneScreen, new THREE.MeshStandardMaterial({ map: phoneTexture, emissive: "#ffffff", emissiveMap: phoneTexture, emissiveIntensity: 0.85, roughness: 0.3, side: THREE.DoubleSide }));
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
          if (object.name.startsWith("guide-robot-eye")) {
            // Compressed meshes carry their dequantisation in the node scale: blink relative to it.
            object.userData.baseScaleY = object.scale.y;
            robotEyes.push(object);
          }
        });

        // Keep artwork out of the GLB image table. This avoids blob URL races
        // when the hub unmounts and makes both planes use one predictable loader.
        const monitorScreen = mountedModel.getObjectByName("monitor-portfolio-screen");
        if (monitorScreen instanceof THREE.Mesh) {
          const screenTexture = paintWallpaper(getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif");
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
      if (selectedIdRef.current === "projects" && pickupRef.current.phase === "held" && hit && hit !== "robot" && hit.id === "projects") {
        // The printed repo link opens the repo; anywhere else turns the page.
        const uv = briefMesh ? raycaster.intersectObject(briefMesh, false)[0]?.uv : undefined;
        if (uv && projectLink && uv.x >= projectLink.u0 && uv.x <= projectLink.u1 && uv.y >= projectLink.v0 && uv.y <= projectLink.v1) {
          window.open(projectLink.href, "_blank", "noopener");
          return;
        }
        turnProjectRef.current?.(1);
        return;
      }
      if (selectedIdRef.current === "education" && pickupRef.current.phase === "held" && hit && hit !== "robot" && hit.id === "education") {
        turnCertificateRef.current?.();
        return;
      }
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
    let daylightClock = 0;
    let fill = daylight.fill;
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
        // In the hand, an artifact is out of the desk's shadows (otherwise the
        // lamp prints the laptop and keyboard across a held phone's screen).
        const setReceive = (id: string | null, receive: boolean) => {
          if (!id) return;
          interactiveRoots.get(id)?.traverse((object) => {
            if (object instanceof THREE.Mesh) object.receiveShadow = receive;
          });
        };
        setReceive(decorHiddenFor, true);
        setReceive(decorFor, false);
        const screenHeld = decorFor === "work" || decorFor === "contact";
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
      const overlaid = !READ_IN_PLACE.has(pickup.targetId as SurfaceNode);
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

      tickFlips(dt);
      tickSwap(dt);

      // The phone's lock-screen clock ticks with Singapore time.
      const phoneNow = Math.floor(sgtHourRef.current * 60);
      if (phoneNow !== phoneMinute) {
        phoneMinute = phoneNow;
        paintPhoneScreen(phoneCanvas, phoneFont, sgtHourRef.current);
        phoneTexture.needsUpdate = true;
      }

      // Window light follows Singapore time; checked every few seconds since
      // it changes over minutes, and eased so a jump (e.g. after a sleeping
      // tab wakes) fades rather than snaps.
      daylightClock -= dt;
      if (daylightClock <= 0) {
        daylightClock = 5;
        daylightAt(sgtHourRef.current, daylight);
      }
      const daylightEase = 1 - Math.exp(-dt * 1.5);
      windowLight.color.lerp(daylight.light, daylightEase);
      windowLight.intensity += (daylight.intensity - windowLight.intensity) * daylightEase;
      windowLight.position.lerp(daylight.position, daylightEase);
      ambient.color.lerp(daylight.sky, daylightEase);
      ambient.groundColor.lerp(daylight.ground, daylightEase);
      airColor.lerp(daylight.air, daylightEase);
      fog.color.copy(airColor);
      fill += (daylight.fill - fill) * daylightEase;
      if (paneMaterial) {
        paneMaterial.emissive.lerp(daylight.pane, daylightEase);
        paneMaterial.emissiveIntensity += (daylight.paneStrength - paneMaterial.emissiveIntensity) * daylightEase;
      }

      // Lights: the lamp dims a little while an artifact is held up to you.
      const lampLevel = (introDone ? 1 : lampCurve(introSeconds)) * (1 - 0.4 * pickupEase) * lampLevelRef.current;
      lamp.intensity = LAMP_INTENSITY * lampLevel;
      bounce.intensity = 1.3 * lampLevel;
      ambient.intensity = fill + 0.36 * (introDone ? 1 : lampCurve(introSeconds));
      inspectLight.intensity = 22 * pickupEase;
      if (bulbMaterial) bulbMaterial.emissiveIntensity = 7 * lampLevel;
      // A heavier vignette by day keeps darkness around the desk while the room is lit.
      finish.uniforms.uStrength.value = 0.42 + 0.22 * pickupEase + Math.max(0, fill - 0.12) * 0.9;
      finish.uniforms.uTime.value = reduced ? 0 : clock;

      // Ambient life (frozen for reduced motion).
      if (!reduced) {
        const flicker = 0.95 + 0.03 * Math.sin(clock * 7.3) + (Math.sin(clock * 0.7) > 0.995 ? -0.25 : 0);
        if (monitorMaterial) monitorMaterial.color.setScalar(flicker);
        monitorGlow.intensity = 2.6 * flicker;
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
          eye.scale.y = (eye.userData.baseScaleY as number) * blink;
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
    : selectedHotspot?.id === "projects"
    ? "Click the page or use ← → to turn it · click outside to put it back"
    : selectedHotspot?.id === "education"
    ? "Click the certificate or use ← → to see the other one"
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
      <div className="workstation-stage" aria-label={`Darren's desk ${sgtHour === null || partOfDay(sgtHour) === "night" ? "at night" : `in the ${partOfDay(sgtHour)}`}, with seven objects you can pick up`}>
        {!introComplete && status === "ready" ? (
          <div className="workstation-intro" aria-live="polite">
            <span className="eyebrow">{sgtHour === null ? "Singapore" : `${formatSgt(sgtHour)} · Singapore`}</span>
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
        {selectedHotspot && !READ_IN_PLACE.has(selectedHotspot.node) ? <ObjectSurface node={selectedHotspot.node} onClose={closeSelection} /> : null}
      </div>
      {/* The resume and keyboard are read on the 3D objects themselves; screen readers get the text. */}
      {selectedHotspot && READ_IN_PLACE.has(selectedHotspot.node) ? (
        <div className="visually-hidden">
          <ObjectSurface node={selectedHotspot.node} onClose={closeSelection} />
        </div>
      ) : null}
    </div>
  );
}
