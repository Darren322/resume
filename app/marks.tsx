import type { IconType } from "react-icons";
import { FaAws, FaSalesforce } from "react-icons/fa6";
import {
  SiApachespark,
  SiDatabricks,
  SiDocker,
  SiExpress,
  SiFastapi,
  SiGithub,
  SiGithubactions,
  SiGitlab,
  SiJavascript,
  SiKeycloak,
  SiMongodb,
  SiMysql,
  SiNextdotjs,
  SiNodedotjs,
  SiOpenjdk,
  SiOpencv,
  SiPostgresql,
  SiPython,
  SiRabbitmq,
  SiReact,
  SiSonarqubecloud,
  SiSpringboot,
  SiSupabase,
  SiTailwindcss,
  SiTypescript,
  SiVercel,
  SiVitest,
} from "react-icons/si";
import type { NodeId, ResumeItem } from "./resume-data";

export type TechnologyMarkId =
  | "amazonwebservices"
  | "apachespark"
  | "cloudflare"
  | "databricks"
  | "docker"
  | "express"
  | "fastapi"
  | "github"
  | "githubactions"
  | "gitlab"
  | "gmail"
  | "govtechairbase"
  | "javascript"
  | "java"
  | "keycloak"
  | "mongodb"
  | "mysql"
  | "nextjs"
  | "nodejs"
  | "openai"
  | "opencv"
  | "pm2"
  | "playwright"
  | "powerapps"
  | "powerautomate"
  | "postgresql"
  | "python"
  | "rabbitmq"
  | "raspberrypi"
  | "recaptcha"
  | "react"
  | "salesforce"
  | "s3"
  | "sharepoint"
  | "sonarqube"
  | "springboot"
  | "supabase"
  | "sqs"
  | "sql"
  | "tailwindcss"
  | "telegram"
  | "typescript"
  | "ufw"
  | "vercel"
  | "vike"
  | "vitest"
  | "websockets";

type TechnologyMarkDefinition = {
  Icon?: IconType;
  label: string;
  color: string;
  short?: string;
};

const technologyMarks: Record<TechnologyMarkId, TechnologyMarkDefinition> = {
  amazonwebservices: { Icon: FaAws, label: "Amazon Web Services", color: "#ffb86b" },
  apachespark: { Icon: SiApachespark, label: "Apache Spark", color: "#e25a2c" },
  cloudflare: { label: "Cloudflare", short: "CF", color: "#f38020" },
  databricks: { Icon: SiDatabricks, label: "Databricks", color: "#ff5f46" },
  docker: { Icon: SiDocker, label: "Docker", color: "#2496ed" },
  express: { Icon: SiExpress, label: "Express.js", color: "#e8eef6" },
  fastapi: { Icon: SiFastapi, label: "FastAPI", color: "#67e8f9" },
  github: { Icon: SiGithub, label: "GitHub", color: "#f5f7fa" },
  githubactions: { Icon: SiGithubactions, label: "GitHub Actions", color: "#79b8ff" },
  gitlab: { Icon: SiGitlab, label: "GitLab", color: "#fc6d26" },
  gmail: { label: "Gmail", short: "GM", color: "#ea4335" },
  govtechairbase: { label: "GovTech Airbase", short: "GT", color: "#67e8f9" },
  javascript: { Icon: SiJavascript, label: "JavaScript", color: "#f7df1e" },
  java: { Icon: SiOpenjdk, label: "Java / OpenJDK", color: "#f89820" },
  keycloak: { Icon: SiKeycloak, label: "Keycloak", color: "#4d9de0" },
  mongodb: { Icon: SiMongodb, label: "MongoDB", color: "#47a248" },
  mysql: { Icon: SiMysql, label: "MySQL", color: "#6da9d2" },
  nextjs: { Icon: SiNextdotjs, label: "Next.js", color: "#f5f7fa" },
  nodejs: { Icon: SiNodedotjs, label: "Node.js", color: "#83cd29" },
  openai: { label: "OpenAI", short: "AI", color: "#d8f3e8" },
  opencv: { Icon: SiOpencv, label: "OpenCV", color: "#5c8dbc" },
  pm2: { label: "PM2", short: "PM2", color: "#a7d46f" },
  // Simple Icons does not ship a Playwright mark in this bundled release; keep the label explicit rather than borrowing another tool's logo.
  playwright: { label: "Playwright", short: "PW", color: "#45ba4b" },
  powerapps: { label: "Power Apps", short: "PA", color: "#742774" },
  powerautomate: { label: "Power Automate", short: "PA", color: "#0066ff" },
  postgresql: { Icon: SiPostgresql, label: "PostgreSQL", color: "#699eca" },
  python: { Icon: SiPython, label: "Python", color: "#ffd43b" },
  rabbitmq: { Icon: SiRabbitmq, label: "RabbitMQ", color: "#ffb86b" },
  raspberrypi: { label: "Raspberry Pi", short: "PI", color: "#d33c62" },
  recaptcha: { label: "reCAPTCHA", short: "reCAP", color: "#4c9aff" },
  react: { Icon: SiReact, label: "React", color: "#61dafb" },
  salesforce: { Icon: FaSalesforce, label: "Salesforce", color: "#00a1e0" },
  s3: { label: "Amazon S3", short: "S3", color: "#ffb86b" },
  sharepoint: { label: "SharePoint", short: "SP", color: "#038387" },
  sonarqube: { Icon: SiSonarqubecloud, label: "SonarQube", color: "#4e9bcd" },
  springboot: { Icon: SiSpringboot, label: "Spring Boot", color: "#6db33f" },
  supabase: { Icon: SiSupabase, label: "Supabase", color: "#3ecf8e" },
  sqs: { label: "Amazon SQS", short: "SQS", color: "#ffb86b" },
  sql: { label: "SQL", short: "SQL", color: "#82b5d8" },
  tailwindcss: { Icon: SiTailwindcss, label: "Tailwind CSS", color: "#38bdf8" },
  telegram: { label: "Telegram", short: "TG", color: "#2aabee" },
  typescript: { Icon: SiTypescript, label: "TypeScript", color: "#3178c6" },
  ufw: { label: "UFW", short: "UFW", color: "#b8c7d8" },
  vercel: { Icon: SiVercel, label: "Vercel", color: "#f5f7fa" },
  vike: { label: "Vike", short: "VK", color: "#f2a65a" },
  vitest: { Icon: SiVitest, label: "Vitest", color: "#729b1b" },
  websockets: { label: "WebSockets", short: "WS", color: "#67e8f9" },
};

export type OrganizationMarkId = "coders-assembly" | "edb" | "mitsubishi-electric" | "nyp" | "smu" | "yjs";

type OrganizationMarkDefinition = {
  label: string;
  short: string;
  color: string;
};

const organizationMarks: Record<OrganizationMarkId, OrganizationMarkDefinition> = {
  "coders-assembly": { label: "Coders Assembly", short: "CA", color: "#ffb86b" },
  edb: { label: "Singapore Economic Development Board", short: "EDB", color: "#67e8f9" },
  "mitsubishi-electric": { label: "Mitsubishi Electric Asia", short: "ME", color: "#ed1c24" },
  nyp: { label: "Nanyang Polytechnic", short: "NYP", color: "#8b7cf6" },
  smu: { label: "Singapore Management University", short: "SMU", color: "#f5f7fa" },
  yjs: { label: "Yong Jin Solutions Engineering", short: "YJS", color: "#9dc7ff" },
};

function matches(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function technologyMarkFor(value: string | undefined): TechnologyMarkId | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[·/]/g, " ");

  if (matches(normalized, ["next.js", "nextjs"])) return "nextjs";
  if (matches(normalized, ["react"])) return "react";
  if (matches(normalized, ["typescript"])) return "typescript";
  if (matches(normalized, ["javascript"])) return "javascript";
  if (matches(normalized, ["python"])) return "python";
  if (matches(normalized, ["java"])) return "java";
  if (matches(normalized, ["spring boot", "springboot"])) return "springboot";
  if (matches(normalized, ["fastapi"])) return "fastapi";
  if (matches(normalized, ["docker"])) return "docker";
  if (matches(normalized, ["aws", "amazon web services"])) return "amazonwebservices";
  if (matches(normalized, ["gitlab"])) return "gitlab";
  if (matches(normalized, ["github actions"])) return "githubactions";
  if (matches(normalized, ["github"])) return "github";
  if (matches(normalized, ["postgresql"])) return "postgresql";
  if (matches(normalized, ["supabase"])) return "supabase";
  if (matches(normalized, ["playwright"])) return "playwright";
  if (matches(normalized, ["node.js", "nodejs"])) return "nodejs";
  if (matches(normalized, ["express.js", "expressjs"])) return "express";
  if (matches(normalized, ["tailwind css", "tailwindcss"])) return "tailwindcss";
  if (matches(normalized, ["mongodb", "mongo db"])) return "mongodb";
  if (matches(normalized, ["mysql"])) return "mysql";
  if (matches(normalized, ["apache spark", "apachespark"])) return "apachespark";
  if (matches(normalized, ["databricks"])) return "databricks";
  if (matches(normalized, ["salesforce"])) return "salesforce";
  if (matches(normalized, ["rabbitmq"])) return "rabbitmq";
  if (matches(normalized, ["keycloak"])) return "keycloak";
  if (matches(normalized, ["opencv"])) return "opencv";
  if (matches(normalized, ["openai"])) return "openai";
  if (matches(normalized, ["vitest"])) return "vitest";
  if (matches(normalized, ["sonarqube"])) return "sonarqube";
  if (matches(normalized, ["vercel"])) return "vercel";
  if (matches(normalized, ["vike"])) return "vike";
  if (matches(normalized, ["cloudflare"])) return "cloudflare";
  if (matches(normalized, ["raspberry pi", "raspberrypi"])) return "raspberrypi";
  if (matches(normalized, ["pm2"])) return "pm2";
  if (matches(normalized, ["ufw"])) return "ufw";
  if (matches(normalized, ["govtech airbase", "govtechairbase"])) return "govtechairbase";
  if (matches(normalized, ["power apps", "powerapps"])) return "powerapps";
  if (matches(normalized, ["power automate", "powerautomate"])) return "powerautomate";
  if (matches(normalized, ["sharepoint"])) return "sharepoint";
  if (matches(normalized, ["recaptcha"])) return "recaptcha";
  if (matches(normalized, ["telegram"])) return "telegram";
  if (matches(normalized, ["gmail"])) return "gmail";
  if (matches(normalized, ["websocket", "websockets"])) return "websockets";
  if (matches(normalized, ["sqs"])) return "sqs";
  if (matches(normalized, ["s3"])) return "s3";
  if (matches(normalized, ["sql"])) return "sql";

  return null;
}

export function organizationMarkFor(value: string | undefined): OrganizationMarkId | null {
  if (!value) return null;
  const normalized = value.toLowerCase();

  if (normalized.includes("economic development board")) return "edb";
  if (normalized.includes("yong jin solutions")) return "yjs";
  if (normalized.includes("mitsubishi electric")) return "mitsubishi-electric";
  if (normalized.includes("singapore management university")) return "smu";
  if (normalized.includes("coders assembly")) return "coders-assembly";
  if (normalized.includes("nanyang polytechnic")) return "nyp";

  return null;
}

type MarkProps = {
  className?: string;
  decorative?: boolean;
};

/** A technology's brand colour, e.g. for single-ink stamps. */
export function technologyColor(id: TechnologyMarkId) {
  return technologyMarks[id].color;
}

/** The logo component for a technology, when it has one. */
export function technologyIcon(id: TechnologyMarkId) {
  return technologyMarks[id].Icon;
}

/** Whether a technology has a real logo (not just a short text mark). */
export function technologyHasLogo(id: TechnologyMarkId) {
  return Boolean(technologyMarks[id].Icon);
}

export function TechIcon({ id, className, decorative = true }: MarkProps & { id: TechnologyMarkId }) {
  const definition = technologyMarks[id];
  const Icon = definition.Icon;

  return (
    <span
      className={`tech-mark ${className ?? ""}`.trim()}
      style={{ color: definition.color }}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : definition.label}
      role={decorative ? undefined : "img"}
    >
      {Icon ? <Icon aria-hidden="true" focusable="false" /> : <span className="tech-mark-text">{definition.short}</span>}
    </span>
  );
}

export function OrganizationMark({ id, className, decorative = true }: MarkProps & { id: OrganizationMarkId }) {
  const definition = organizationMarks[id];

  return (
    <span
      className={`org-mark ${className ?? ""}`.trim()}
      style={{ color: definition.color, borderColor: `${definition.color}66` }}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : definition.label}
      role={decorative ? undefined : "img"}
    >
      {definition.short}
    </span>
  );
}

export function ItemMark({ item, className }: { item: ResumeItem; className?: string }) {
  return <RecordMark item={item} className={className} decorative={false} />;
}

export function RecordMark({ item, className, decorative = true }: { item: ResumeItem; className?: string; decorative?: boolean }) {
  const organization = organizationMarkFor(item.title);
  if (organization) return <OrganizationMark id={organization} className={className} decorative={decorative} />;

  const technology = technologyMarkFor(item.subtitle) ?? technologyMarkFor(item.visual.nodes[0]);
  if (technology) return <TechIcon id={technology} className={className} decorative={decorative} />;

  const monogram = item.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={`record-mark-monogram org-mark ${className ?? ""}`.trim()}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : `${item.title} mark`}
    >
      {monogram || "•"}
    </span>
  );
}
