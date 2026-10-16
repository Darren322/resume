// Identity and URLs shared by metadata, structured data, and the page itself.

/** Canonical origin used by metadata, the sitemap, and structured data. */
export const siteUrl = "https://darrenyijie.dev";

export const site = {
  name: "Darren Ng",
  fullName: "Darren Ng Yijie",
  jobTitle: "Software Engineer",
  locality: "Singapore",
  title: "Darren Ng — Software Engineer in Singapore",
  description:
    "Resume of Darren Ng Yijie, a Singapore software engineer and SMU student building full-stack products, data pipelines and AI systems with Next.js, Spring Boot and AWS.",
  email: "darren.ng577@gmail.com",
};

export const profileLinks = {
  email: `mailto:${site.email}`,
  github: "https://github.com/Darren322",
  linkedin: "https://linkedin.com/in/darren-ng-yijie-190696288",
};

/** CC BY 4.0 Sketchfab models on the desk; the licence requires this credit. */
export const modelCredits = [
  { object: "Laptop", title: "MacBook Pro M3 Space Black 16\" Free", author: "EV_car2013", url: "https://sketchfab.com/3d-models/6b46aa09dc4d4e90a79ea06f1d0aa719" },
  { object: "Phone", title: "iPhone 17 Pro Max", author: "MajdyModels", url: "https://sketchfab.com/3d-models/87fc1df741384124a8ce0226d2b2058d" },
  { object: "Monitor", title: "Ultra-Wide Monitor", author: "Dumb Yet Creative", url: "https://sketchfab.com/3d-models/f7445b4b5d84412aa58ed7379483267c" },
  { object: "Lamp", title: "Luxo L-1P Orange Architect's Table Lamp", author: "Kuutti Siitonen", url: "https://sketchfab.com/3d-models/f27b6bc0cac8456c937a5b27b343ede5" },
  { object: "Mug", title: "Old Ceramic Mug", author: "Coozy", url: "https://sketchfab.com/3d-models/e553f0cf76454aab8c4f4b22be781c9c" },
  { object: "Folder", title: "Document File Folder", author: "Kami Rapacz", url: "https://sketchfab.com/3d-models/11390179bba7462484d344e2fe22c703" },
  { object: "Notebook", title: "Notebook", author: "demagdev", url: "https://sketchfab.com/3d-models/b58d334fb340449589e1efb9dc3e6119" },
  { object: "Graduation cap", title: "Graduation Cap (With Textures)", author: "Safina Irani", url: "https://sketchfab.com/3d-models/2e86ede4261e41c4a8f0f14248b73a70" },
];

/**
 * Phones and small screens load the desk with 1024px textures (about a quarter
 * of the GPU memory); mobile Safari kills the tab when the full set is resident.
 */
export const lightDeskMedia = "(pointer: coarse), (max-width: 720px)";
export const fullDeskMedia = "not ((pointer: coarse) or (max-width: 720px))";
export const deskModels = {
  full: "/assets/workstation.glb",
  light: "/assets/workstation-mobile.glb",
};
