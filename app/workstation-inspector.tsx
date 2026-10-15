"use client";

import { RecordMark, TechIcon, technologyMarkFor } from "./marks";
import { resumeData, type NodeId, type ResumeItem, type ResumeNode } from "./resume-data";

const resumePdf = "/assets/Darren_Ng_YJ_Resume.pdf";

const contactLinks = {
  phone: "tel:+6584185922",
  email: "mailto:darren.ng577@gmail.com",
  github: "https://github.com/Darren322",
  linkedin: "https://linkedin.com/in/darren-ng-yijie-190696288",
} as const;

export type WorkstationInspectorProps = {
  /** The node currently being held up for inspection. A null node removes the rail. */
  selectedNode: NodeId | null;
  /** Return the held artifact to the workstation. */
  onClose: () => void;
};

function domId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "record";
}

function RecordList({
  label,
  values,
  className = "",
}: {
  label: string;
  values: string[];
  className?: string;
}) {
  if (!values.length) return null;

  return (
    <section className={`workstation-inspector-record-list ${className}`.trim()} aria-label={label}>
      <h4 className="workstation-inspector-subheading">{label}</h4>
      <ul className="workstation-inspector-list">
        {values.map((value) => <li key={value}>{value}</li>)}
      </ul>
    </section>
  );
}

function Showcase({ item }: { item: ResumeItem }) {
  if (!item.showcase) return null;

  return (
    <section className="workstation-inspector-showcase" aria-label="Project showcase">
      <div className="workstation-inspector-section-heading">
        <h4 className="workstation-inspector-subheading">Project story</h4>
        <span className="workstation-inspector-section-count">
          {item.showcase.features.length} {item.showcase.features.length === 1 ? "feature" : "features"}
        </span>
      </div>
      <p className="workstation-inspector-showcase-summary">{item.showcase.summary}</p>
      <div className="workstation-inspector-feature-grid">
        {item.showcase.features.map((feature) => (
          <article className="workstation-inspector-feature" key={feature.id}>
            <p className="workstation-inspector-feature-eyebrow">{feature.eyebrow}</p>
            <h5>{feature.label}</h5>
            <p>{feature.description}</p>
            {feature.technologies?.length ? (
              <ul className="workstation-inspector-feature-technologies" aria-label={`${feature.label} technologies`}>
                {feature.technologies.map((technology) => {
                  const mark = technologyMarkFor(technology);
                  return (
                    <li key={technology}>
                      {mark ? <TechIcon id={mark} className="workstation-inspector-feature-mark" /> : null}
                      <span>{technology}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function RecordArticle({ item, index }: { item: ResumeItem; index: number }) {
  const recordId = `workstation-inspector-record-${index}-${domId(item.title)}`;

  return (
    <article className="workstation-inspector-record" aria-labelledby={`${recordId}-title`}>
      <header className="workstation-inspector-record-header">
        <span className="workstation-inspector-record-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <RecordMark item={item} className="workstation-inspector-record-mark" />
        <div className="workstation-inspector-record-heading">
          <h3 id={`${recordId}-title`}>{item.title}</h3>
          {item.subtitle ? <p className="workstation-inspector-record-subtitle">{item.subtitle}</p> : null}
        </div>
        {item.period ? <time className="workstation-inspector-record-period">{item.period}</time> : null}
      </header>

      <p className="workstation-inspector-record-label">{item.visual.label}</p>
      <div className="workstation-inspector-record-body">
        <RecordList label="Details" values={item.bullets} className="workstation-inspector-details" />
        <RecordList label="Working stack" values={item.visual.nodes} className="workstation-inspector-stack" />
        <RecordList label="Outcomes" values={item.visual.outcomes} className="workstation-inspector-outcomes" />
      </div>
      <Showcase item={item} />
    </article>
  );
}

function SkillGroup({ item }: { item: ResumeItem }) {
  const skills = Array.from(new Set(item.visual.nodes.length ? item.visual.nodes : item.bullets.flatMap((bullet) => bullet.split(" · "))));

  return (
    <article className="workstation-inspector-skill-group" aria-labelledby={`workstation-inspector-skill-${domId(item.title)}`}>
      <header className="workstation-inspector-skill-header">
        <div>
          <h3 id={`workstation-inspector-skill-${domId(item.title)}`}>{item.title}</h3>
          {item.subtitle ? <p>{item.subtitle}</p> : null}
        </div>
        <span className="workstation-inspector-section-count">{skills.length} {skills.length === 1 ? "skill" : "skills"}</span>
      </header>
      <ul className="workstation-inspector-skill-list" aria-label={`${item.title} skills`}>
        {skills.map((skill) => {
          const mark = technologyMarkFor(skill);
          return (
            <li className="workstation-inspector-skill" key={skill}>
              {mark && mark !== "sql" ? <TechIcon id={mark} className="workstation-inspector-skill-mark" /> : <span className="workstation-inspector-skill-dot" aria-hidden="true" />}
              <span className="workstation-inspector-skill-name">{skill}</span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

type ContactChannel = {
  label: string;
  value: string;
  href: string;
};

function contactChannels(node: ResumeNode): ContactChannel[] {
  const lines = node.items.flatMap((item) => item.bullets);

  return lines.flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 0) return [];

    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const normalized = label.toLowerCase();
    const href = normalized === "phone"
      ? contactLinks.phone
      : normalized === "email"
        ? contactLinks.email
        : normalized === "github"
          ? contactLinks.github
          : normalized === "linkedin"
            ? contactLinks.linkedin
            : null;

    return href ? [{ label, value, href }] : [];
  });
}

function ContactPanel({ node }: { node: ResumeNode }) {
  const item = node.items[0];
  const channels = contactChannels(node);

  return (
    <section className="workstation-inspector-contact" aria-labelledby="workstation-inspector-contact-heading">
      <header className="workstation-inspector-contact-header">
        <p className="workstation-inspector-kicker">Direct channels</p>
        <h3 id="workstation-inspector-contact-heading">{item?.title ?? node.label}</h3>
        {item?.subtitle ? <p>{item.subtitle}</p> : null}
        {item?.period ? <time>{item.period}</time> : null}
      </header>
      <p className="workstation-inspector-contact-lede">{node.lede}</p>
      <nav className="workstation-inspector-contact-links" aria-label="Contact links">
        {channels.map((channel) => (
          <a className="workstation-inspector-contact-link" href={channel.href} key={channel.label}>
            <span className="workstation-inspector-contact-label">{channel.label}</span>
            <span className="workstation-inspector-contact-value">{channel.value}</span>
          </a>
        ))}
      </nav>
      <div className="workstation-inspector-contact-actions" aria-label="Resume actions">
        <a className="workstation-inspector-action" href={resumePdf} target="_blank" rel="noreferrer">Open readable resume</a>
        <a className="workstation-inspector-action" href={resumePdf} download>Download PDF</a>
      </div>
    </section>
  );
}

function ResumeEntry({ item, detailed = true }: { item: ResumeItem; detailed?: boolean }) {
  return (
    <article className="resume-paper-entry">
      <header>
        <strong>{item.title}</strong>
        {item.period ? <time>{item.period}</time> : null}
      </header>
      {item.subtitle ? <p className="resume-paper-subtitle">{item.subtitle}</p> : null}
      {detailed && item.bullets.length ? (
        <ul>
          {item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
        </ul>
      ) : null}
    </article>
  );
}

/** The full one-page resume, set like the printed PDF, for the paper held in hand. */
function ResumePaper({ onClose }: { onClose: () => void }) {
  const sections: Array<{ title: string; items: ResumeItem[]; detailed?: boolean }> = [
    { title: "Work Experience", items: resumeData.work.items },
    { title: "Projects & Achievements", items: resumeData.projects.items },
    { title: "Education", items: resumeData.education.items },
    { title: "Additional Experience", items: resumeData.teaching.items, detailed: false },
  ];

  return (
    <aside className="workstation-inspector workstation-inspector-resume" aria-labelledby="resume-paper-name">
      <nav className="resume-paper-toolbar" aria-label="Resume actions">
        <a href={resumePdf} target="_blank" rel="noreferrer">Open PDF</a>
        <a href={resumePdf} download>Download</a>
        <button type="button" onClick={onClose}>Put back <span aria-hidden="true">↩</span></button>
      </nav>
      <div className="workstation-inspector-content resume-paper">
        <header className="resume-paper-head">
          <h2 id="resume-paper-name">Darren Ng Yijie</h2>
          <p>
            <a href={contactLinks.phone}>+65 8418 5922</a>
            <a href={contactLinks.email}>darren.ng577@gmail.com</a>
            <a href={contactLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={contactLinks.github} target="_blank" rel="noreferrer">GitHub</a>
          </p>
        </header>
        {sections.map((section) => (
          <section className="resume-paper-section" key={section.title} aria-label={section.title}>
            <h3>{section.title}</h3>
            {section.items.map((item) => (
              <ResumeEntry item={item} detailed={section.detailed ?? true} key={`${item.title}-${item.period ?? ""}`} />
            ))}
          </section>
        ))}
        <section className="resume-paper-section" aria-label="Technical skills">
          <h3>Technical Skills</h3>
          <dl className="resume-paper-skills">
            {resumeData.skills.items.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.bullets.join(" · ").split(" · ").join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </aside>
  );
}

export function WorkstationInspector({ selectedNode, onClose }: WorkstationInspectorProps) {
  if (!selectedNode) return null;
  if (selectedNode === "profile") return <ResumePaper onClose={onClose} />;

  const node = resumeData[selectedNode];
  const headingId = `workstation-inspector-heading-${selectedNode}`;

  return (
    <aside className="workstation-inspector" aria-labelledby={headingId}>
      <header className="workstation-inspector-header">
        <div className="workstation-inspector-header-copy">
          <p className="workstation-inspector-kicker">{node.index} / {node.zone}</p>
          <h2 id={headingId}>{node.label}</h2>
          <p className="workstation-inspector-hint">{node.hint}</p>
        </div>
        <button className="workstation-inspector-close" type="button" onClick={onClose} aria-label="Put it back on the desk">
          <span aria-hidden="true">↩</span>
          <span>Put back</span>
        </button>
      </header>

      <div className="workstation-inspector-content">
        {selectedNode === "contact" ? <ContactPanel node={node} /> : null}
        {selectedNode === "skills" ? (
          <section className="workstation-inspector-skills" aria-labelledby={`${headingId}-skills-heading`}>
            <header className="workstation-inspector-section-intro">
              <h3 id={`${headingId}-skills-heading`}>The stack behind the systems</h3>
              <p>{node.lede}</p>
            </header>
            <div className="workstation-inspector-skill-groups">
              {node.items.map((item) => <SkillGroup item={item} key={item.title} />)}
            </div>
          </section>
        ) : null}
        {selectedNode !== "contact" && selectedNode !== "skills" ? (
          <section className="workstation-inspector-records" aria-labelledby={`${headingId}-records-heading`}>
            <header className="workstation-inspector-section-intro">
              <h3 id={`${headingId}-records-heading`}>{node.label} record</h3>
              <p>{node.lede}</p>
            </header>
            <div className="workstation-inspector-record-listing">
              {node.items.map((item, index) => <RecordArticle item={item} index={index} key={`${item.title}-${item.period ?? index}`} />)}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

export default WorkstationInspector;
