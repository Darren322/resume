export type ResumeItem = {
  title: string;
  /** Short name for tabs and sidebars, e.g. "EDB". */
  short?: string;
  subtitle?: string;
  period?: string;
  /** The single result a recruiter should see first, with what it measures. */
  highlight?: { value: string; label: string };
  /** Tools named for this item on the resume. */
  stack?: string[];
  bullets: string[];
  visual: ResumeVisual;
  showcase?: ProjectShowcase;
};

export type ResumeVisualKind =
  | "channels"
  | "credentials"
  | "pipeline"
  | "profile"
  | "rack"
  | "stack"
  | "workflow";

export type ResumeVisual = {
  kind: ResumeVisualKind;
  label: string;
  nodes: string[];
  outcomes: string[];
};

export type ProjectShowcaseSceneKind =
  | "dashboard"
  | "conversation"
  | "delivery"
  | "camera"
  | "analysis"
  | "cloud";

export type ProjectShowcaseFeature = {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  kind: ProjectShowcaseSceneKind;
  technologies?: string[];
};

export type ProjectShowcase = {
  summary: string;
  features: ProjectShowcaseFeature[];
};

export type ResumeNode = {
  index: string;
  label: string;
  zone: string;
  hint: string;
  lede: string;
  items: ResumeItem[];
  tags: string[];
};

export type NodeId =
  | "profile"
  | "work"
  | "projects"
  | "teaching"
  | "education"
  | "skills"
  | "contact";

// Recruiter priority: resume, work and projects first.
export const nodeOrder: NodeId[] = [
  "profile",
  "work",
  "projects",
  "skills",
  "education",
  "teaching",
  "contact",
];

export const resumeData: Record<NodeId, ResumeNode> = {
  profile: {
    index: "NODE 00",
    label: "Resume",
    zone: "Identity Atrium",
    hint: "The best place to begin.",
    lede:
      "Software engineering student and builder working across product platforms, cloud migration, data pipelines, multi-agent AI systems, and developer education.",
    items: [
      {
        title: "Darren Ng Yijie",
        subtitle: "Software Engineer · Singapore",
        period: "Open to opportunities",
        bullets: [
          "Pursuing a BSc in Software Engineering (Work-Study) at Singapore Management University · GPA 3.61/4.00 · Dean’s List AY2025/2026.",
          "Software Engineering Intern at the Singapore Economic Development Board, building events and data platforms on GovTech Airbase.",
          "TikTok TechJam 2026 finalist (Top 12) for LiuQi, a multi-agent orchestration system.",
          "Experience spans government technology, full-stack delivery, cloud migration, data engineering, and teaching.",
        ],
        visual: {
          kind: "profile",
          label: "Experience signal",
          nodes: [
            "Software Engineering",
            "Singapore Management University",
            "Government technology",
            "Cloud migration",
            "Data engineering",
            "Multi-agent systems",
            "Teaching",
          ],
          outcomes: ["Full-stack", "Cloud", "Data", "AI agents", "Teaching"],
        },
      },
    ],
    tags: ["Full-stack", "Cloud", "Data", "AI agents", "Teaching"],
  },
  work: {
    index: "NODE 01",
    label: "Work",
    zone: "Build Lab",
    hint: "Production platforms and transformation work.",
    lede:
      "Hands-on engineering across government technology, freelance product delivery, and enterprise process transformation.",
    items: [
      {
        title: "Singapore Economic Development Board",
        short: "EDB",
        subtitle: "Software Engineering Intern · Singapore Global Network",
        period: "Jun 2026 — Present",
        highlight: { value: "3 s → 0.5 s", label: "repeated event-search queries, after adding caching to SearchSG" },
        stack: ["Next.js", "React", "Node.js", "Express.js", "GitLab CI/CD", "Vitest", "Playwright", "SonarQube", "Databricks", "Apache Spark", "GovTech Airbase", "AWS"],
        bullets: [
          "Rebuilt a React/Vite prototype as a Next.js events platform integrating GEVME, Hivebrite, Salesforce, and Luma; integrated SearchSG event search with caching, reducing repeated-query response times from ~3 s to ~0.5 s.",
          "Migrated an internal React and Node.js/Express data-mapping platform from AWS to GovTech Airbase and implemented AI-assisted field mapping, significantly reducing manual Salesforce data preparation.",
          "Built GitLab CI/CD pipelines with Vitest, Playwright, and SonarQube for automated testing and staging/production deployments; contributed to Databricks and Apache Spark ETL pipelines using a medallion architecture.",
        ],
        visual: {
          kind: "pipeline",
          label: "Event platform / delivery flow",
          nodes: [
            "GEVME · Hivebrite · Salesforce · Luma",
            "Next.js events platform · SearchSG",
            "GitLab CI/CD · Vitest · Playwright",
            "SonarQube analysis",
            "Databricks · Apache Spark ETL",
            "GovTech Airbase",
          ],
          outcomes: [
            "~3 s → ~0.5 s repeated queries",
            "Next.js events platform",
            "AI-assisted field mapping",
            "GitLab CI/CD",
            "Vitest · Playwright",
            "SonarQube",
            "GovTech Airbase",
            "Databricks · Apache Spark",
          ],
        },
      },
      {
        title: "Yong Jin Solutions Engineering Pte Ltd",
        short: "Yong Jin",
        subtitle: "Full-Stack Developer · Freelance",
        period: "May 2025 — Apr 2026",
        highlight: { value: "116K+", label: "Google Search impressions and 2.3K+ organic clicks for the company site" },
        stack: ["Express.js", "Supabase", "Raspberry Pi", "PM2", "UFW", "Cloudflare"],
        bullets: [
          "Developed and deployed an SSR company website with an Express.js/Supabase backend, generating 116K+ Google Search impressions and 2.3K+ organic clicks.",
          "Built contact automation with reCAPTCHA, Telegram alerts, and Gmail auto-replies; self-hosted and secured the backend on a Raspberry Pi with PM2, UFW, and Cloudflare SSL.",
        ],
        visual: {
          kind: "stack",
          label: "Product delivery stack",
          nodes: [
            "SSR company website",
            "Express.js · Supabase",
            "reCAPTCHA · Telegram alerts · Gmail auto-replies",
            "Raspberry Pi · PM2 · UFW",
            "Cloudflare SSL",
          ],
          outcomes: [
            "116K+ Google Search impressions",
            "2.3K+ organic clicks",
            "Contact automation",
            "Self-hosted backend",
            "Cloudflare SSL",
          ],
        },
      },
      {
        title: "Mitsubishi Electric Asia Pte Ltd",
        short: "Mitsubishi Electric",
        subtitle: "HR Digital Transformation Intern",
        period: "Sep 2021 — Feb 2022",
        highlight: { value: "20+", label: "paper forms turned into automated approval workflows" },
        stack: ["Power Apps", "Power Automate", "SharePoint"],
        bullets: [
          "Digitized 20+ paper-based forms and automated multi-level approval workflows using Power Apps, Power Automate, and SharePoint, reducing reliance on manual paperwork.",
        ],
        visual: {
          kind: "workflow",
          label: "Approval workflow",
          nodes: ["Paper-based forms", "Power Apps", "Power Automate", "SharePoint"],
          outcomes: ["20+ paper-based forms", "Multi-level approval workflows"],
        },
      },
    ],
    tags: [
      "Next.js",
      "React",
      "Node.js",
      "GitLab CI/CD",
      "Databricks",
      "Apache Spark",
      "GovTech Airbase",
    ],
  },
  projects: {
    index: "NODE 02",
    label: "Projects",
    zone: "Project Lab",
    hint: "A hackathon finalist and two end-to-end systems.",
    lede:
      "System-heavy builds combining multi-agent orchestration, microservices, real-time communication, computer vision, asynchronous processing, and secure access control.",
    items: [
      {
        title: "TikTok TechJam 2026 — Finalist (Top 12)",
        short: "LiuQi",
        subtitle: "LiuQi · Multi-agent orchestration",
        period: "Sep 2026",
        highlight: { value: "Top 12", label: "finalist at TikTok TechJam 2026" },
        stack: ["Mastra", "BytePlus"],
        bullets: [
          "Built Mastra-based multi-agent orchestration with validated supervisor routing, bounded context handoffs, and persisted write leases for coordinating agents on shared code.",
          "Implemented human approval gates for sensitive agent tools with execution claims and cancellation checks to prevent duplicate or stale tool invocations.",
          "Optimized agent context with handoff deduplication and reusable prompt prefixes; configured BytePlus prompt caching and cache-aware token tracking to reduce and diagnose repeated input costs.",
        ],
        visual: {
          kind: "pipeline",
          label: "Agent coordination flow",
          nodes: [
            "Supervisor routing",
            "Bounded context handoffs",
            "Persisted write leases",
            "Human approval gates",
            "Prompt caching · token tracking",
          ],
          outcomes: [
            "Top 12 finalist",
            "Validated supervisor routing",
            "No duplicate or stale tool calls",
            "Cache-aware cost tracking",
          ],
        },
        showcase: {
          summary: "LiuQi coordinates multiple coding agents on a shared codebase without letting them overwrite each other, with a human approving anything sensitive.",
          features: [
            {
              id: "agent-orchestration",
              label: "Agent orchestration",
              eyebrow: "COORDINATION",
              description: "Mastra supervisor routing, bounded context handoffs, and persisted write leases so agents can share code safely.",
              kind: "conversation",
              technologies: ["Mastra"],
            },
            {
              id: "approval-gates",
              label: "Human approval gates",
              eyebrow: "SAFETY",
              description: "Sensitive tools wait for approval, with execution claims and cancellation checks against duplicate or stale invocations.",
              kind: "delivery",
            },
            {
              id: "context-costs",
              label: "Context and cost",
              eyebrow: "EFFICIENCY",
              description: "Handoff deduplication, reusable prompt prefixes, BytePlus prompt caching, and cache-aware token tracking.",
              kind: "analysis",
            },
          ],
        },
      },
      {
        title: "AI-Powered Learning Management System",
        short: "Learning platform",
        subtitle: "React · Spring Boot · FastAPI",
        period: "Jan 2026 — Apr 2026",
        highlight: { value: "4 AI services", label: "similarity detection, moderation, chatbot and role-play, behind RabbitMQ workers" },
        stack: ["React", "Spring Boot", "FastAPI", "RabbitMQ", "Keycloak", "Docker", "GitHub Actions"],
        bullets: [
          "Co-developed a Dockerized microservices platform with FastAPI services for vector similarity detection, OpenAI moderation, chatbot and AI role-play workflows, using RabbitMQ workers for long-running tasks.",
          "Implemented Keycloak role- and ownership-based access control, service-to-service authentication, WebSocket live chat, automated tests, and GitHub Actions CI/CD.",
        ],
        visual: {
          kind: "pipeline",
          label: "Learning platform flow",
          nodes: [
            "Lessons · enrolment · quizzes",
            "React · Spring Boot · FastAPI",
            "Vector similarity · OpenAI moderation",
            "Chatbot · AI role-play",
            "RabbitMQ workers",
            "Keycloak access control",
            "WebSocket live chat · GitHub Actions CI/CD",
          ],
          outcomes: [
            "Dockerized microservices",
            "Vector similarity detection",
            "OpenAI moderation",
            "Chatbot and AI role-play",
            "RabbitMQ workers",
            "Keycloak access control",
            "WebSocket live chat",
            "GitHub Actions CI/CD",
          ],
        },
        showcase: {
          summary: "A Dockerized learning platform combining course workflows, AI-assisted experiences, real-time chat, and secure microservices.",
          features: [
            {
              id: "learning-experience",
              label: "Learning experience",
              eyebrow: "PRODUCT",
              description: "Lessons, enrolment, quizzes, progress tracking, and content moderation in one platform.",
              kind: "dashboard",
              technologies: ["React"],
            },
            {
              id: "ai-workflows",
              label: "AI workflows",
              eyebrow: "INTELLIGENCE",
              description: "Vector similarity, moderation, chatbot, and AI role-play services built with FastAPI.",
              kind: "conversation",
              technologies: ["FastAPI"],
            },
            {
              id: "secure-delivery",
              label: "Secure delivery",
              eyebrow: "PLATFORM",
              description: "RabbitMQ workers, Keycloak access control, WebSocket chat, Docker, automated tests, and GitHub Actions CI/CD.",
              kind: "delivery",
              technologies: ["RabbitMQ", "Keycloak", "Docker", "GitHub Actions"],
            },
          ],
        },
      },
      {
        title: "Facial Recognition Attendance System",
        short: "Face attendance",
        subtitle: "Java · Spring Boot · OpenCV · AWS",
        period: "Aug 2025 — Oct 2025",
        highlight: { value: "10 → 40+ FPS", label: "real-time recognition throughput, about 4× faster" },
        stack: ["Java", "Spring Boot", "OpenCV", "AWS"],
        bullets: [
          "Improved real-time face-recognition throughput from 10 FPS to 40+ FPS (~4×) using multithreaded frame processing and temporal consistency; built WebSocket streaming and an asynchronous S3/SQS training-image pipeline.",
        ],
        visual: {
          kind: "pipeline",
          label: "Attendance processing flow",
          nodes: ["Facial-training images", "OpenCV · Spring Boot", "AWS S3 · SQS", "WebSocket video"],
          outcomes: ["10 → 40+ FPS (~4×)", "Multithreaded frame processing", "Temporal consistency", "WebSocket video streaming", "AWS S3 · SQS pipeline"],
        },
        showcase: {
          summary: "A real-time attendance system combining face recognition, frame processing, WebSocket video, and asynchronous AWS training uploads.",
          features: [
            {
              id: "live-recognition",
              label: "Live recognition",
              eyebrow: "EXPERIENCE",
              description: "Real-time face detection and recognition with WebSocket video streaming.",
              kind: "camera",
            },
            {
              id: "processing-engine",
              label: "Processing engine",
              eyebrow: "APPLICATION",
              description: "Java, Spring Boot, and OpenCV with multithreaded frame processing and temporal consistency — 10 FPS to 40+ FPS.",
              kind: "analysis",
              technologies: ["Java", "Spring Boot", "OpenCV"],
            },
            {
              id: "cloud-training",
              label: "Cloud training",
              eyebrow: "INFRASTRUCTURE",
              description: "An asynchronous AWS S3 and SQS pipeline for uploaded facial-training images.",
              kind: "cloud",
              technologies: ["AWS"],
            },
          ],
        },
      },
    ],
    tags: [
      "Multi-agent systems",
      "Microservices",
      "RabbitMQ",
      "Keycloak",
      "WebSockets",
      "OpenCV",
      "AWS S3/SQS",
    ],
  },
  teaching: {
    index: "NODE 03",
    label: "Teaching",
    zone: "Mentor Bay",
    hint: "Turning debugging into understanding.",
    lede:
      "Teaching experience grounded in technical guidance, code review, and helping students form durable problem-solving habits.",
    items: [
      {
        title: "Singapore Management University",
        short: "SMU",
        subtitle: "Teaching Assistant · Object-Oriented Programming (IS442)",
        period: "Jan 2026 — May 2026",
        bullets: [
          "Supported students applying object-oriented design principles and debugging programming assignments through technical guidance and code review.",
        ],
        visual: {
          kind: "workflow",
          label: "Mentor loop",
          nodes: ["OOP design", "Technical guidance", "Code review", "Debugging assignments"],
          outcomes: ["Object-oriented design principles", "Programming assignments"],
        },
      },
      {
        title: "Coders Assembly",
        short: "Coders Assembly",
        subtitle: "Programming Mentor · Programming Fundamentals (CS102)",
        period: "Jan 2026 — May 2026",
        bullets: [
          "Mentored student programmers in foundational concepts, problem-solving, and debugging through personalised technical guidance.",
        ],
        visual: {
          kind: "workflow",
          label: "Learning loop",
          nodes: ["Programming fundamentals", "Problem-solving", "Technical guidance", "Debugging"],
          outcomes: ["Foundational concepts", "Personalised technical guidance"],
        },
      },
    ],
    tags: ["OOP", "Code review", "Debugging", "Mentorship"],
  },
  education: {
    index: "NODE 04",
    label: "Education",
    zone: "Study Archive",
    hint: "Academic records and proof tokens.",
    lede:
      "A software engineering work-study degree built on an engineering and business foundation.",
    items: [
      {
        title: "Singapore Management University",
        short: "SMU",
        subtitle: "BSc (Software Engineering) · Work-Study Degree",
        period: "Aug 2024 — May 2028",
        bullets: ["GPA 3.61/4.00", "Dean’s List · Academic Year 2025/2026"],
        visual: {
          kind: "credentials",
          label: "Academic record",
          nodes: ["BSc (Software Engineering)", "Work-Study Degree", "GPA 3.61/4.00", "Dean’s List"],
          outcomes: ["GPA 3.61/4.00", "Dean’s List", "Academic Year 2025/2026"],
        },
      },
      {
        title: "Nanyang Polytechnic",
        short: "Nanyang Poly",
        subtitle: "Diploma in Engineering with Business",
        period: "Apr 2019 — Apr 2022",
        bullets: ["GPA 3.71/4.00", "Director’s List · 2019–2021"],
        visual: {
          kind: "credentials",
          label: "Academic record",
          nodes: ["Diploma in Engineering with Business", "GPA 3.71/4.00", "Director’s List"],
          outcomes: ["GPA 3.71/4.00", "Director’s List", "2019–2021"],
        },
      },
    ],
    tags: ["Software Engineering", "Dean’s List", "Engineering", "Business"],
  },
  skills: {
    index: "NODE 05",
    label: "Skills",
    zone: "Systems Console",
    hint: "The stack behind the systems.",
    lede:
      "A practical stack spanning typed application development, API services, data engineering, cloud platforms, and deployment automation.",
    items: [
      {
        title: "Languages",
        subtitle: "Core",
        bullets: ["Java · Python · TypeScript · JavaScript · SQL"],
        visual: {
          kind: "rack",
          label: "Language rack",
          nodes: ["Java", "Python", "TypeScript", "JavaScript", "SQL"],
          outcomes: ["Java", "Python", "TypeScript", "JavaScript", "SQL"],
        },
      },
      {
        title: "Frameworks",
        subtitle: "Application",
        bullets: [
          "Next.js · React · Node.js · Express.js · FastAPI · Spring Boot · Mastra · OpenCV",
        ],
        visual: {
          kind: "rack",
          label: "Application rack",
          nodes: ["Next.js", "React", "Node.js", "Express.js", "FastAPI", "Spring Boot", "Mastra", "OpenCV"],
          outcomes: ["Next.js", "React", "Node.js", "Express.js", "FastAPI", "Spring Boot", "Mastra", "OpenCV"],
        },
      },
      {
        title: "Data, Cloud & Tools",
        subtitle: "Infrastructure",
        bullets: [
          "AWS · GovTech Airbase · Databricks · Apache Spark · PostgreSQL · Supabase · MySQL · MongoDB · Docker · OpenTelemetry · GitLab CI/CD · GitHub Actions · Vitest · Playwright · SonarQube",
        ],
        visual: {
          kind: "rack",
          label: "Infrastructure rack",
          nodes: [
            "AWS",
            "GovTech Airbase",
            "Databricks",
            "Apache Spark",
            "PostgreSQL",
            "Supabase",
            "MySQL",
            "MongoDB",
            "Docker",
            "OpenTelemetry",
            "GitLab CI/CD",
            "GitHub Actions",
            "Vitest",
            "Playwright",
            "SonarQube",
          ],
          outcomes: [
            "AWS",
            "GovTech Airbase",
            "Databricks",
            "Apache Spark",
            "PostgreSQL",
            "Supabase",
            "MySQL",
            "MongoDB",
            "Docker",
            "OpenTelemetry",
            "GitLab CI/CD",
            "GitHub Actions",
            "Vitest",
            "Playwright",
            "SonarQube",
          ],
        },
      },
    ],
    tags: [
      "Java",
      "Python",
      "TypeScript",
      "React",
      "Spring Boot",
      "FastAPI",
      "AWS",
      "Docker",
    ],
  },
  contact: {
    index: "NODE 06",
    label: "Contact",
    zone: "Contact Gate",
    hint: "Open a direct channel.",
    lede:
      "Thanks for exploring the lab. Continue the conversation through email, GitHub, or LinkedIn—or take the conventional resume with you.",
    items: [
      {
        title: "Open channel",
        subtitle: "Singapore · GMT+8",
        period: "Ready",
        bullets: [
          "Phone: +65 8418 5922",
          "Email: darren.ng577@gmail.com",
          "GitHub: github.com/Darren322",
          "LinkedIn: linkedin.com/in/darren-ng-yijie-190696288",
        ],
        visual: {
          kind: "channels",
          label: "Direct channels",
          nodes: ["Phone", "Email", "GitHub", "LinkedIn", "PDF Resume"],
          outcomes: ["Phone", "Email", "GitHub", "LinkedIn", "PDF Resume"],
        },
      },
    ],
    tags: ["Phone", "Email", "GitHub", "LinkedIn", "PDF Resume"],
  },
};
