"use client";

import { TechIcon, technologyMarkFor } from "./marks";
import type { NodeId, ResumeItem } from "./resume-data";
import { ProjectShowcase } from "./project-showcase";

function Mark({ value }: { value: string }) {
  const mark = technologyMarkFor(value);
  return mark ? <TechIcon id={mark} /> : <span className="journey-scene-monogram" aria-hidden="true">{value.slice(0, 2).toUpperCase()}</span>;
}

function ProfileScene() {
  return (
    <div className="chapter-scene journey-scene journey-scene-profile" role="img" aria-label="Identity scene for Darren Ng Yijie, software engineer in Singapore">
      <figure className="journey-paper-sheet"><img src="/assets/resume-page-1.png" loading="lazy" decoding="async" alt="Rendered first page of Darren Ng Yijie's resume" /><figcaption>Resume / identity artifact</figcaption></figure>
      <div className="journey-profile-lines" aria-hidden="true"><span>PRODUCT</span><span>DATA</span><span>AI</span><span>TEACHING</span></div>
      <div className="journey-scene-note" aria-hidden="true">identity / paper / direction</div>
    </div>
  );
}

function ProjectCoverScene({ item, index }: { item: ResumeItem; index: number }) {
  const lms = index === 0;
  return (
    <div className={`chapter-scene journey-scene journey-scene-project ${lms ? "journey-scene-lms" : "journey-scene-attendance"}`} role="img" aria-label={`${item.title} project preview: ${item.showcase?.summary ?? item.visual.label}`}>
      <div className="journey-project-window" aria-hidden="true">
        <div className="journey-project-window-bar"><i /><i /><i /><strong>{lms ? "LEARNING PLATFORM" : "ATTENDANCE / LIVE"}</strong></div>
        {lms ? (
          <div className="journey-lms-ui">
            <div className="journey-lms-sidebar"><b>LEARN</b><span /><span /><span /><span /></div>
            <div className="journey-lms-main"><small>CONTINUE LEARNING</small><strong>Course hub</strong><i /><div><b>LESSONS</b><b>QUIZZES</b><b>PROGRESS</b></div></div>
          </div>
        ) : (
          <div className="journey-attendance-ui"><span className="journey-camera-corner" /><span className="journey-camera-corner" /><div><Mark value="OpenCV" /><strong>RECOGNIZED</strong></div><small>WEBSOCKET VIDEO</small></div>
        )}
      </div>
      <div className="journey-project-badge" aria-hidden="true"><Mark value={lms ? "React" : "Java"} /><span>{lms ? "MICROSERVICES" : "REAL-TIME"}</span></div>
      <div className="journey-scene-note" aria-hidden="true">artifact / preview / contribution</div>
    </div>
  );
}

function TeachingScene({ index }: { index: number }) {
  return (
    <div className="chapter-scene journey-scene journey-scene-teaching" role="img" aria-label="Mentor loop showing technical guidance, code review, and debugging">
      <div className="journey-mentor-signal" aria-hidden="true"><span>{index === 0 ? "OOP DESIGN" : "FOUNDATIONS"}</span><i /><span>GUIDANCE</span><i /><span>UNDERSTANDING</span></div>
      <div className="journey-mentor-core" aria-hidden="true"><span>↗</span><small>MENTOR LOOP</small></div>
      <div className="journey-scene-note" aria-hidden="true">question / review / understanding</div>
    </div>
  );
}

function SkillsScene({ item }: { item: ResumeItem }) {
  return (
    <div className="chapter-scene journey-scene journey-scene-skills" role="img" aria-label={`${item.title} technology wall: ${item.visual.nodes.join(", ")}`}>
      <div className="journey-tool-wall" aria-hidden="true">
        {item.visual.nodes.map((node) => <span key={node}><Mark value={node} /><b>{node}</b></span>)}
      </div>
      <div className="journey-scene-note" aria-hidden="true">tools / evidence / working stack</div>
    </div>
  );
}

function ContactScene() {
  return (
    <div className="chapter-scene journey-scene journey-scene-contact" role="img" aria-label="Direct contact channels for email, GitHub, LinkedIn, and the PDF resume">
      <div className="journey-contact-device" aria-hidden="true"><span>@</span><i /><b>OPEN CHANNEL</b></div>
      <div className="journey-contact-labels" aria-hidden="true"><span>EMAIL</span><span>GITHUB</span><span>LINKEDIN</span><span>PDF</span></div>
      <div className="journey-scene-note" aria-hidden="true">direct / open / ready</div>
    </div>
  );
}

export function JourneyScene({ nodeId, item, index }: { nodeId: NodeId; item: ResumeItem; index: number }) {
  if (nodeId === "profile") return <ProfileScene />;
  if (nodeId === "projects" && item.showcase) return <div className="journey-project-showcase" aria-label={`${item.title} project showcase`}><ProjectShowcase showcase={item.showcase} /></div>;
  if (nodeId === "projects") return <ProjectCoverScene item={item} index={index} />;
  if (nodeId === "teaching") return <TeachingScene index={index} />;
  if (nodeId === "skills") return <SkillsScene item={item} />;
  if (nodeId === "contact") return <ContactScene />;
  if (nodeId === "education") return <div className={`chapter-scene journey-scene journey-paper-scene ${index === 0 ? "journey-paper-smu" : "journey-paper-nyp"}`} role="img" aria-label={`${item.title} academic record with ${item.bullets.join(" and ")}`}><figure className="journey-paper-sheet"><img src="/assets/resume-page-1.png" loading="lazy" decoding="async" alt="Rendered first page of the resume containing the education record" /><figcaption>{index === 0 ? "SMU / academic archive" : "NYP / academic archive"}</figcaption></figure><div className="journey-paper-stamp" aria-hidden="true">{index === 0 ? "3.61 GPA" : "3.71 GPA"}</div></div>;
  if (index === 0) return <div className="chapter-scene chapter-scene-events" role="img" aria-label="Event platform scene aggregating GEVME, Hivebrite, Salesforce, and Luma into a Next.js platform for GovTech Airbase"><div className="chapter-scene-grid" aria-hidden="true" /><div className="chapter-event-sources" aria-hidden="true"><span>GEVME</span><span>HIVEBRITE</span><span>SALESFORCE</span><span>LUMA</span></div><div className="chapter-event-core" aria-hidden="true"><small>EVENT PLATFORM</small><span className="chapter-scene-tech"><TechIcon id="nextjs" /><strong>Next.js</strong></span><i /><b /><em /></div><div className="chapter-event-destination" aria-hidden="true"><span>GOVTECH</span><strong>AIRBASE</strong><TechIcon id="gitlab" /></div><div className="chapter-scene-note" aria-hidden="true">events / data / delivery</div></div>;
  if (index === 1) return <div className="chapter-scene chapter-scene-self-hosted" role="img" aria-label="Self-hosted company platform scene with React, Express.js, Supabase, Raspberry Pi, and Vercel"><div className="chapter-browser-bar" aria-hidden="true"><span /><span /><span /><b>YJS / COMPANY SITE</b></div><div className="chapter-browser-body" aria-hidden="true"><div className="chapter-browser-hero"><small>PRODUCT DELIVERY</small><strong>Build once.<br />Run deliberately.</strong><i /></div><div className="chapter-browser-stack"><span><TechIcon id="react" /><b>REACT</b><small>VIKE · TAILWIND CSS</small></span><span><TechIcon id="express" /><b>EXPRESS.JS</b><small>SUPABASE</small></span><span className="chapter-stack-pi"><b>Raspberry Pi</b><small>PM2 · UFW</small></span></div></div><div className="chapter-host-badge" aria-hidden="true"><span>SELF-HOSTED</span><b>SSL</b><small>CLOUDFLARE</small></div><div className="chapter-scene-note" aria-hidden="true">frontend / backend / deployment</div></div>;
  return <div className="chapter-scene chapter-scene-approvals" role="img" aria-label="Manual forms transformed into a multi-level approval workflow with Power Apps, Power Automate, and SharePoint"><div className="chapter-paper-stack" aria-hidden="true"><span /><span /><span /><b>20+</b><small>FORMS</small></div><div className="chapter-approval-panel" aria-hidden="true"><small><span className="chapter-power-mark">PP</span> APPROVAL QUEUE</small><strong>HR REQUEST</strong><span><i /> POWER APPS</span><span><i /> POWER AUTOMATE</span><span><i /> SHAREPOINT</span></div><div className="chapter-approval-stamp" aria-hidden="true">APPROVED</div><div className="chapter-scene-note" aria-hidden="true">manual forms / automation / approvals</div></div>;
}

export function ContactActions() {
  return (
    <nav className="journey-contact-actions" aria-label="Contact actions">
      <a href="mailto:darren.ng577@gmail.com"><span className="journey-action-mark">@</span><strong>Email</strong><small>darren.ng577@gmail.com</small></a>
      <a href="https://github.com/Darren322" target="_blank" rel="noreferrer"><span className="journey-action-mark">GH</span><strong>GitHub</strong><small>github.com/Darren322</small></a>
      <a href="https://linkedin.com/in/darren-ng-yijie-190696288" target="_blank" rel="noreferrer"><span className="journey-action-mark">in</span><strong>LinkedIn</strong><small>Darren Ng Yijie</small></a>
      <a href="/assets/Darren_Ng_YJ_Resume.pdf" download><span className="journey-action-mark">PDF</span><strong>Resume</strong><small>Download PDF</small></a>
    </nav>
  );
}
