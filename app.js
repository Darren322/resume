const resumeData = {
  profile: {
    index: "NODE 00",
    label: "Profile",
    zone: "Identity Atrium",
    hint: "The best place to begin.",
    lede: "Software engineering student and builder working across product platforms, cloud infrastructure, data pipelines, AI workflows, and developer education.",
    items: [
      {
        title: "Darren Ng Yijie",
        subtitle: "Software Engineer · Singapore",
        period: "Open to opportunities",
        bullets: [
          "Currently pursuing a BSc in Software Engineering at Singapore Management University.",
          "Experience spans government technology, full-stack delivery, cloud migration, data engineering, and teaching.",
        ],
      },
    ],
    tags: ["Full-stack", "Cloud", "Data", "AI systems", "Teaching"],
  },
  work: {
    index: "NODE 01",
    label: "Work",
    zone: "Build Lab",
    hint: "Production platforms and transformation work.",
    lede: "Hands-on engineering across government technology, freelance product delivery, and enterprise process transformation.",
    items: [
      {
        title: "Singapore Economic Development Board",
        subtitle: "Software Engineering Intern · Singapore Global Network",
        period: "Jun 2026 — Present",
        bullets: [
          "Rebuilt a React/Vite prototype as a Next.js event platform aggregating GEVME, Hivebrite, Salesforce, and Luma.",
          "Built GitLab CI/CD with Vitest, Playwright, and SonarQube for staging and production on GovTech Airbase.",
          "Migrated an internal React and Node.js/Express data-mapping platform from AWS to GovTech Airbase and developed AI-assisted field mapping.",
          "Contributed to Databricks and Apache Spark ETL pipelines using a medallion architecture.",
        ],
      },
      {
        title: "Yong Jin Solutions Engineering Pte Ltd",
        subtitle: "Full-Stack Developer · Freelance",
        period: "May 2025 — Apr 2026",
        bullets: [
          "Developed an SSR company website with React, Vike, and Tailwind CSS plus an Express.js and Supabase backend.",
          "Self-hosted and secured the backend on a Raspberry Pi with PM2, UFW, and Cloudflare SSL; deployed the frontend on Vercel.",
        ],
      },
      {
        title: "Mitsubishi Electric Asia Pte Ltd",
        subtitle: "HR Digital Transformation Intern",
        period: "Sep 2021 — Feb 2022",
        bullets: [
          "Digitized 20+ manual forms and automated multi-level approval workflows using Power Apps, Power Automate, and SharePoint.",
        ],
      },
    ],
    tags: ["Next.js", "React", "Node.js", "GitLab CI/CD", "Databricks", "Apache Spark", "GovTech Airbase"],
  },
  projects: {
    index: "NODE 02",
    label: "Projects",
    zone: "Project Lab",
    hint: "Two end-to-end systems under glass.",
    lede: "System-heavy builds combining microservices, real-time communication, computer vision, asynchronous processing, and secure access control.",
    items: [
      {
        title: "AI-Powered Learning Management System",
        subtitle: "React · Spring Boot · FastAPI",
        period: "Jan 2026 — Apr 2026",
        bullets: [
          "Co-developed a Dockerized microservices platform for lessons, enrolment, quizzes, progress tracking, and content moderation.",
          "Built FastAPI services for vector similarity, OpenAI moderation, chatbot, and AI role-play workflows with RabbitMQ workers.",
          "Implemented Keycloak access control, service authentication, WebSocket chat, automated tests, and GitHub Actions CI/CD.",
        ],
      },
      {
        title: "Facial Recognition Attendance System",
        subtitle: "Java · Spring Boot · OpenCV · AWS",
        period: "Aug 2025 — Oct 2025",
        bullets: [
          "Built real-time face detection and recognition with multithreaded frame processing, REST APIs, and WebSocket video streaming.",
          "Designed an asynchronous AWS pipeline using S3 and SQS to process uploaded facial-training images.",
        ],
      },
    ],
    tags: ["Microservices", "RabbitMQ", "Keycloak", "WebSockets", "OpenCV", "AWS S3/SQS"],
  },
  teaching: {
    index: "NODE 03",
    label: "Teaching",
    zone: "Mentor Bay",
    hint: "Turning debugging into understanding.",
    lede: "Teaching experience grounded in technical guidance, code review, and helping students form durable problem-solving habits.",
    items: [
      {
        title: "Singapore Management University",
        subtitle: "Teaching Assistant · Object-Oriented Programming (IS442)",
        period: "Jan 2026 — May 2026",
        bullets: [
          "Supported students applying object-oriented design principles and debugging programming assignments through technical guidance and code review.",
        ],
      },
      {
        title: "Coders Assembly",
        subtitle: "Programming Mentor · Programming Fundamentals (CS102)",
        period: "Jan 2026 — May 2026",
        bullets: [
          "Mentored student programmers in foundational concepts, problem-solving, and debugging through personalised technical guidance.",
        ],
      },
    ],
    tags: ["OOP", "Code review", "Debugging", "Mentorship"],
  },
  education: {
    index: "NODE 04",
    label: "Education",
    zone: "Study Archive",
    hint: "Academic records and proof tokens.",
    lede: "A software engineering work-study degree built on an engineering and business foundation.",
    items: [
      {
        title: "Singapore Management University",
        subtitle: "BSc (Software Engineering) · Work-Study Degree",
        period: "Aug 2024 — May 2028",
        bullets: ["GPA 3.61/4.00", "Dean’s List · Academic Year 2025/2026"],
      },
      {
        title: "Nanyang Polytechnic",
        subtitle: "Diploma in Engineering with Business",
        period: "Apr 2019 — Apr 2022",
        bullets: ["GPA 3.71/4.00", "Director’s List · 2019–2021"],
      },
    ],
    tags: ["Software Engineering", "Dean’s List", "Engineering", "Business"],
  },
  skills: {
    index: "NODE 05",
    label: "Skills",
    zone: "Systems Console",
    hint: "The stack behind the systems.",
    lede: "A practical stack spanning typed application development, API services, data engineering, cloud platforms, and deployment automation.",
    items: [
      {
        title: "Languages",
        subtitle: "Core",
        bullets: ["Java · Python · TypeScript · JavaScript · SQL"],
      },
      {
        title: "Frameworks",
        subtitle: "Application",
        bullets: ["Next.js · React · Node.js · Express.js · FastAPI · Spring Boot · Tailwind CSS · OpenCV"],
      },
      {
        title: "Cloud, Data & DevOps",
        subtitle: "Infrastructure",
        bullets: ["AWS · GovTech Airbase · Databricks · Apache Spark · Salesforce · PostgreSQL · Supabase · MySQL · MongoDB · Docker · GitLab CI/CD · GitHub Actions · Vitest · Playwright · SonarQube"],
      },
    ],
    tags: ["Java", "Python", "TypeScript", "React", "Spring Boot", "FastAPI", "AWS", "Docker"],
  },
  contact: {
    index: "NODE 06",
    label: "Contact",
    zone: "Contact Gate",
    hint: "Open a direct channel.",
    lede: "Thanks for exploring the lab. Continue the conversation through email, GitHub, or LinkedIn—or take the conventional resume with you.",
    items: [
      {
        title: "Open channel",
        subtitle: "Singapore · GMT+8",
        period: "Ready",
        bullets: [
          "Email: darren.ng577@gmail.com",
          "GitHub: github.com/Darren322",
          "LinkedIn: Darren Ng Yijie",
        ],
      },
    ],
    tags: ["Email", "GitHub", "LinkedIn", "PDF Resume"],
  },
};

const nodeOrder = ["profile", "work", "projects", "teaching", "education", "skills", "contact"];
const nodePositions = {
  profile: { x: 550, y: 340 },
  work: { x: 260, y: 170 },
  projects: { x: 840, y: 170 },
  teaching: { x: 190, y: 515 },
  education: { x: 520, y: 540 },
  skills: { x: 900, y: 515 },
  contact: { x: 1000, y: 340 },
};

const state = {
  player: { x: 550, y: 410 },
  keys: new Set(),
  visited: new Set(),
  nearby: "profile",
  active: "profile",
  lastFrame: 0,
  touchMove: null,
};

const els = {
  world: document.querySelector("#world"),
  avatar: document.querySelector("#avatar"),
  boot: document.querySelector("#bootScreen"),
  intel: document.querySelector("#intelDialog"),
  resume: document.querySelector("#quickResume"),
  help: document.querySelector("#helpDialog"),
  proximity: document.querySelector("#proximityPrompt"),
  routeList: document.querySelector("#routeList"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  currentSignal: document.querySelector("#currentSignal"),
  currentSignalHint: document.querySelector("#currentSignalHint"),
  toast: document.querySelector("#toast"),
  coordX: document.querySelector("#coordX"),
  coordY: document.querySelector("#coordY"),
};

function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[character]));
}

function itemMarkup(item, classPrefix = "intel") {
  const bullets = (item.bullets || [])
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join("");

  return `
    <article class="${classPrefix}-item">
      <div class="${classPrefix}-item-head">
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.subtitle ? `<p class="${classPrefix}-subtitle">${escapeHtml(item.subtitle)}</p>` : ""}
        </div>
        ${item.period ? `<span class="${classPrefix}-period">${escapeHtml(item.period)}</span>` : ""}
      </div>
      ${bullets ? `<ul>${bullets}</ul>` : ""}
    </article>`;
}

function buildRoutes() {
  els.routeList.innerHTML = nodeOrder.map((id, index) => `
    <button class="route-item" type="button" data-route="${id}">
      <span class="route-number">${String(index).padStart(2, "0")}</span>
      <span class="route-name">${resumeData[id].label}</span>
      <span class="route-state" aria-hidden="true"></span>
    </button>
  `).join("");
}

function buildResume() {
  const sections = ["work", "projects", "education", "teaching", "skills"];
  const sectionTitles = {
    work: "Work experience",
    projects: "Selected projects",
    education: "Education",
    teaching: "Teaching experience",
    skills: "Technical skills",
  };

  document.querySelector("#resumeBody").innerHTML = sections.map((id) => {
    const data = resumeData[id];

    if (id === "skills") {
      return `
        <section class="resume-section" data-section="skills">
          <h3 class="resume-section-title">${sectionTitles[id]}</h3>
          ${data.items.map((item) => `
            <div class="skills-group">
              <strong>${escapeHtml(item.title)}</strong>
              <div class="resume-tags">
                ${item.bullets[0].split(" · ").map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </section>`;
    }

    return `
      <section class="resume-section" data-section="${id}">
        <h3 class="resume-section-title">${sectionTitles[id]}</h3>
        ${data.items.map((item) => `
          <article class="resume-entry">
            <div class="resume-entry-head">
              <div>
                <h4>${escapeHtml(item.title)}</h4>
                <p class="resume-entry-subtitle">${escapeHtml(item.subtitle || "")}</p>
              </div>
              <span class="resume-entry-period">${escapeHtml(item.period || "")}</span>
            </div>
            <ul>${(item.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
          </article>
        `).join("")}
      </section>`;
  }).join("");
}

function updateProgress() {
  const count = state.visited.size;
  els.progressText.textContent = `${count} / ${nodeOrder.length} nodes`;
  els.progressBar.style.width = `${(count / nodeOrder.length) * 100}%`;

  document.querySelectorAll("[data-node], [data-route]").forEach((element) => {
    const id = element.dataset.node || element.dataset.route;
    element.classList.toggle("visited", state.visited.has(id));
  });
}

function setActiveSignal(id) {
  const data = resumeData[id];
  state.active = id;
  els.currentSignal.textContent = data.zone;
  els.currentSignalHint.textContent = data.hint;

  document.querySelectorAll("[data-route]").forEach((route) => {
    route.classList.toggle("active", route.dataset.route === id);
  });

  document.querySelectorAll(".cable").forEach((cable) => {
    cable.classList.toggle("active", cable.dataset.cable === id);
  });
}

function openIntel(id) {
  const data = resumeData[id];
  if (!data) return;

  state.visited.add(id);
  setActiveSignal(id);
  updateProgress();

  document.querySelector("#intelIndex").textContent = data.index;
  document.querySelector("#intelEyebrow").textContent = data.zone;
  document.querySelector("#intelTitle").textContent = data.label === "Profile" ? "Darren Ng Yijie" : data.label;
  document.querySelector("#intelLede").textContent = data.lede;
  document.querySelector("#intelItems").innerHTML = data.items.map((item) => itemMarkup(item)).join("");
  document.querySelector("#intelTags").innerHTML = data.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  document.querySelector("#intelFooter").textContent = `${data.index} / Signal acquired`;

  if (!els.intel.open) els.intel.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function openResume() {
  els.boot.classList.add("dismissed");
  closeDialog(els.intel);
  closeDialog(els.help);
  if (!els.resume.open) els.resume.showModal();
}

function showHelp() {
  els.boot.classList.add("dismissed");
  if (!els.help.open) els.help.showModal();
}

function enterWorld() {
  els.boot.classList.add("dismissed");
  window.setTimeout(() => els.world.focus(), 300);
  showToast("Lab online — move toward a glowing node");
}

let toastTimer;
function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("visible"), 2400);
}

function nearestNode() {
  let best = null;
  let bestDistance = Infinity;

  Object.entries(nodePositions).forEach(([id, position]) => {
    const distance = Math.hypot(state.player.x - position.x, state.player.y - position.y);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  });

  return bestDistance <= 92 ? best : null;
}

function updateNearby() {
  const nearby = nearestNode();
  state.nearby = nearby;

  document.querySelectorAll("[data-node]").forEach((node) => {
    node.classList.toggle("nearby", node.dataset.node === nearby);
  });

  if (nearby) {
    els.proximity.querySelector("span").textContent = `Inspect ${resumeData[nearby].label.toLowerCase()}`;
    els.proximity.classList.add("visible");
    setActiveSignal(nearby);
  } else {
    els.proximity.classList.remove("visible");
    document.querySelectorAll(".cable").forEach((cable) => cable.classList.remove("active"));
  }
}

function updateAvatar() {
  els.avatar.style.setProperty("--x", state.player.x.toFixed(2));
  els.avatar.style.setProperty("--y", state.player.y.toFixed(2));
  els.coordX.textContent = String(Math.round(state.player.x)).padStart(4, "0");
  els.coordY.textContent = String(Math.round(state.player.y)).padStart(4, "0");
}

function movementVector() {
  let x = 0;
  let y = 0;
  const keys = state.keys;

  if (keys.has("arrowleft") || keys.has("a") || state.touchMove === "left") x -= 1;
  if (keys.has("arrowright") || keys.has("d") || state.touchMove === "right") x += 1;
  if (keys.has("arrowup") || keys.has("w") || state.touchMove === "up") y -= 1;
  if (keys.has("arrowdown") || keys.has("s") || state.touchMove === "down") y += 1;

  return { x, y };
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - state.lastFrame) / 1000 || 0, 0.05);
  state.lastFrame = timestamp;
  const movement = movementVector();
  const moving = movement.x !== 0 || movement.y !== 0;

  if (moving && !els.intel.open && !els.resume.open && !els.help.open && els.boot.classList.contains("dismissed")) {
    const magnitude = Math.hypot(movement.x, movement.y) || 1;
    const speed = 215;
    state.player.x += (movement.x / magnitude) * speed * delta;
    state.player.y += (movement.y / magnitude) * speed * delta;
    state.player.x = Math.max(35, Math.min(1065, state.player.x));
    state.player.y = Math.max(55, Math.min(645, state.player.y));
    els.avatar.classList.toggle("facing-left", movement.x < 0);
    els.avatar.classList.toggle("facing-right", movement.x >= 0);
    els.avatar.classList.add("walking");
    updateAvatar();
    updateNearby();
  } else {
    els.avatar.classList.remove("walking");
  }

  window.requestAnimationFrame(gameLoop);
}

function moveNearNode(id) {
  const target = nodePositions[id];
  if (!target) return;
  state.player.x = target.x;
  state.player.y = Math.min(640, target.y + 64);
  updateAvatar();
  updateNearby();
}

function nextNode() {
  const currentIndex = nodeOrder.indexOf(state.active);
  const nextId = nodeOrder[(currentIndex + 1) % nodeOrder.length];
  moveNearNode(nextId);
  openIntel(nextId);
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  const nodeTarget = event.target.closest("[data-node]");
  const routeTarget = event.target.closest("[data-route]");

  if (actionTarget) {
    const action = actionTarget.dataset.action;
    if (action === "enter-world") enterWorld();
    if (action === "open-resume") openResume();
    if (action === "close-resume") closeDialog(els.resume);
    if (action === "show-help") showHelp();
    if (action === "close-help") closeDialog(els.help);
    if (action === "close-intel") closeDialog(els.intel);
    if (action === "next-node") nextNode();
    if (action === "interact") {
      if (state.nearby) openIntel(state.nearby);
      else showToast("Move closer to a glowing node");
    }
  }

  if (nodeTarget) {
    moveNearNode(nodeTarget.dataset.node);
    openIntel(nodeTarget.dataset.node);
  }

  if (routeTarget) {
    const id = routeTarget.dataset.route;
    moveNearNode(id);
    openIntel(id);
  }
});

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const gameKeys = ["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"];

  if (gameKeys.includes(key)) {
    state.keys.add(key);
    event.preventDefault();
  }

  if ((key === "e" || key === "enter" || key === " ") && !els.boot.classList.contains("dismissed")) {
    enterWorld();
    return;
  }

  if ((key === "e" || key === "enter" || key === " ") && state.nearby && !els.intel.open && !els.resume.open && !els.help.open) {
    event.preventDefault();
    openIntel(state.nearby);
  }

  if (key === "r" && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    openResume();
  }

  if (key === "?" && !els.resume.open && !els.intel.open) showHelp();
});

document.addEventListener("keyup", (event) => {
  state.keys.delete(event.key.toLowerCase());
});

document.querySelectorAll("[data-move]").forEach((button) => {
  const start = (event) => {
    event.preventDefault();
    state.touchMove = button.dataset.move;
  };
  const end = () => { state.touchMove = null; };
  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
  button.addEventListener("pointerleave", end);
});

[els.intel, els.resume, els.help].forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

buildRoutes();
buildResume();
updateAvatar();
updateNearby();
window.requestAnimationFrame(gameLoop);
