import type { NodeId } from "./resume-data";

export type JourneySceneKind = "profile" | "work" | "project" | "teaching" | "education" | "skills" | "contact";

export type JourneyChapterConfig = {
  id: NodeId;
  title: string;
  intro: string;
  scene: JourneySceneKind;
  selectionMode?: "records" | "projects" | "skills";
  companion: string[];
};

export const journeyConfigs: Record<NodeId, JourneyChapterConfig> = {
  profile: {
    id: "profile",
    title: "Meet the builder.",
    intro: "A software engineering student building dependable products, data systems, AI workflows, and learning tools.",
    scene: "profile",
    companion: ["Start with the signal that connects the lab."]
  },
  work: {
    id: "work",
    title: "Work, in motion.",
    intro: "Production platforms, self-hosted delivery, and process transformation told through the objects on the desk.",
    scene: "work",
    selectionMode: "records",
    companion: ["Tracing the event platform.", "Checking the self-hosted stack.", "Moving forms into approvals."]
  },
  projects: {
    id: "projects",
    title: "Projects, in focus.",
    intro: "Two end-to-end builds. Choose an artifact, then inspect the concise story before opening its verified details.",
    scene: "project",
    selectionMode: "projects",
    companion: ["Choose a build to bring into focus.", "Reading the attendance system."]
  },
  teaching: {
    id: "teaching",
    title: "Make the hard part click.",
    intro: "Mentorship grounded in technical guidance, code review, and durable problem-solving habits.",
    scene: "teaching",
    selectionMode: "records",
    companion: ["Turning debugging into understanding.", "Keeping the learning loop open."]
  },
  education: {
    id: "education",
    title: "The study archive.",
    intro: "A software engineering work-study degree built on an engineering and business foundation.",
    scene: "education",
    selectionMode: "records",
    companion: ["Archive marker: Dean’s List.", "Foundation layer: engineering + business."]
  },
  skills: {
    id: "skills",
    title: "The tools behind the work.",
    intro: "A practical stack spanning typed applications, API services, data engineering, cloud platforms, and delivery automation.",
    scene: "skills",
    selectionMode: "skills",
    companion: ["Choose a tool wall to inspect.", "The stack is a set of working choices.", "Infrastructure keeps the signal moving."]
  },
  contact: {
    id: "contact",
    title: "Open a channel.",
    intro: "Continue the conversation through email, GitHub, LinkedIn, or the conventional resume.",
    scene: "contact",
    companion: ["The lab is ready for a direct signal."]
  }
};

export function journeyConfigFor(id: NodeId) {
  return journeyConfigs[id];
}
