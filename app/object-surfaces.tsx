"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { FaAnglesLeft, FaAnglesRight, FaBatteryFull, FaChevronLeft, FaChevronRight, FaEnvelope, FaFilePdf, FaGithub, FaLinkedin, FaLock, FaPhone, FaSignal, FaWifi } from "react-icons/fa6";
import { TechIcon, technologyColor, technologyHasLogo, technologyMarkFor } from "./marks";
import { resumeData, type NodeId, type ResumeItem } from "./resume-data";

/**
 * What a visitor sees on an artifact they have picked up. Each object gets the
 * interface it would really have — an app on the laptop, a home screen on the
 * phone, tabs on the folder — instead of one shared document layout.
 */

const resumePdf = "/assets/Darren_Ng_YJ_Resume.pdf";
const links = {
  phone: "tel:+6584185922",
  email: "mailto:darren.ng577@gmail.com",
  github: "https://github.com/Darren322",
  linkedin: "https://linkedin.com/in/darren-ng-yijie-190696288",
};

/** Every pick-up object: a resume section, or the monitor's overview. */
export type SurfaceNode = NodeId | "overview";

type SurfaceProps = { onClose: () => void; onOpen?: (node: SurfaceNode) => void };

/** Page through a list with Previous / Next, remembering the direction for motion. */
function usePager(count: number) {
  const [state, setState] = useState({ index: 0, from: null as number | null, direction: 1 });
  const go = (next: number) => {
    const target = (next + count) % count;
    if (target === state.index) return;
    setState({ index: target, from: state.index, direction: target > state.index ? 1 : -1 });
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") go(state.index + 1);
    else if (event.key === "ArrowLeft") go(state.index - 1);
    else return;
    event.preventDefault();
  };
  const settle = () => setState((current) => ({ ...current, from: null }));
  return { ...state, go, onKeyDown, settle };
}

function Pager({ label, index, items, go }: { label: string; index: number; items: ResumeItem[]; go: (next: number) => void }) {
  const previous = items[(index - 1 + items.length) % items.length];
  const next = items[(index + 1) % items.length];
  return (
    <nav className="obj-pager" aria-label={label}>
      <button type="button" onClick={() => go(index - 1)}>
        <span aria-hidden="true">‹</span> {previous.short ?? previous.title}
      </button>
      <span>{index + 1} of {items.length}</span>
      <button type="button" onClick={() => go(index + 1)}>
        {next.short ?? next.title} <span aria-hidden="true">›</span>
      </button>
    </nav>
  );
}

/** "Role · Team" in the data reads as two plain lines on screen. */
function splitSubtitle(subtitle?: string) {
  const [first, ...rest] = (subtitle ?? "").split(" · ");
  return { first, rest: rest.join(", ") };
}

/* ── Laptop: a browser — one tab per employer, a collapsible contents bar ─── */
function slug(item: ResumeItem) {
  return (item.short ?? item.title).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function WorkLaptop({ onClose }: SurfaceProps) {
  const items = resumeData.work.items;
  const { index, direction, go, onKeyDown } = usePager(items.length);
  const item = items[index];
  const { first: role, rest: team } = splitSubtitle(item.subtitle);
  // Start collapsed on narrow screens, where the page needs the room.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 720);
  const bookmarks = [
    { label: "GitHub", href: links.github, icon: <FaGithub /> },
    { label: "LinkedIn", href: links.linkedin, icon: <FaLinkedin /> },
    { label: "Email me", href: links.email, icon: <FaEnvelope /> },
    { label: "Resume PDF", href: resumePdf, icon: <FaFilePdf /> },
  ];

  return (
    <div className="obj-laptop obj-browser" data-sidebar={sidebarOpen ? "open" : "closed"} onKeyDown={onKeyDown}>
      <header className="obj-browser-chrome">
        <div className="obj-browser-tabs">
          <span className="obj-window-lights">
            <button className="obj-window-light obj-window-close" type="button" onClick={onClose} aria-label="Close the laptop and put it back" />
            <span className="obj-window-light" aria-hidden="true" />
            <span className="obj-window-light" aria-hidden="true" />
          </span>
          <div role="tablist" aria-label="Employers">
            {items.map((entry, entryIndex) => (
              <button type="button" role="tab" key={entry.title} aria-selected={entryIndex === index} onClick={() => go(entryIndex)}>
                {entry.short ?? entry.title}
              </button>
            ))}
          </div>
        </div>
        <div className="obj-browser-toolbar">
          <button type="button" aria-label="Previous employer" onClick={() => go(index - 1)}><FaChevronLeft /></button>
          <button type="button" aria-label="Next employer" onClick={() => go(index + 1)}><FaChevronRight /></button>
          <p className="obj-browser-address"><FaLock aria-hidden="true" /> darren-ng / experience / <strong>{slug(item)}</strong></p>
        </div>
      </header>
      <div className="obj-laptop-body">
        {sidebarOpen ? (
          <nav className="obj-laptop-sidebar" id="laptop-bookmarks" aria-label="Bookmarks">
            <p className="obj-laptop-folder obj-laptop-sidebar-head">
              Experience
              <button type="button" aria-label="Collapse sidebar" aria-controls="laptop-bookmarks" aria-expanded="true" onClick={() => setSidebarOpen(false)}>
                <FaAnglesLeft />
              </button>
            </p>
            {items.map((entry, entryIndex) => (
              <button type="button" key={entry.title} aria-pressed={entryIndex === index} onClick={() => go(entryIndex)}>
                {entry.short ?? entry.title}
                <small>{entry.period}</small>
              </button>
            ))}
            <p className="obj-laptop-folder">Bookmarks</p>
            {bookmarks.map((bookmark) => (
              <a className="obj-laptop-bookmark" key={bookmark.label} href={bookmark.href} target={bookmark.href.startsWith("mailto") ? undefined : "_blank"} rel="noreferrer">
                <span aria-hidden="true">{bookmark.icon}</span>{bookmark.label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="obj-laptop-rail">
            <button type="button" aria-label="Expand sidebar" aria-controls="laptop-bookmarks" aria-expanded="false" onClick={() => setSidebarOpen(true)}>
              <FaAnglesRight />
            </button>
          </div>
        )}
        <article className="obj-laptop-pane" key={item.title} data-direction={direction} aria-live="polite">
          <h2><span aria-hidden="true"># </span>{item.title}</h2>
          <p className="obj-laptop-role">{role}{team ? `, ${team}` : ""}</p>
          <p className="obj-laptop-period">{item.period}</p>
          {item.highlight ? (
            <p className="obj-highlight">
              <strong>{item.highlight.value}</strong>
              <span>{item.highlight.label}</span>
            </p>
          ) : null}
          <ul className="obj-points">
            {item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
          {item.stack?.length ? (
            <ul className="obj-chips" aria-label="Tools used">
              {item.stack.map((tool) => <li key={tool}><code>{tool}</code></li>)}
            </ul>
          ) : null}
          <Pager label="More experience" index={index} items={items} go={go} />
        </article>
      </div>
    </div>
  );
}

/* ── Folder: real tabs, one project brief per tab ──────────────────────────── */
const folderTabColours = ["#2f6f72", "#b8573f", "#c4a067"];

const stampTilts = [-7, 4, -2, 8, -5, 3, -9];

/**
 * A rubber stamp of a tool's logo — the whale, the atom, the leaf — pressed in
 * one worn ink. Tools without a logo get a classic boxed word stamp.
 */
function ToolStamp({ tool, index }: { tool: string; index: number }) {
  const mark = technologyMarkFor(tool);
  const logo = mark ? technologyHasLogo(mark) : false;
  const style = {
    "--ink": mark ? technologyColor(mark) : "var(--pen)",
    "--tilt": `${stampTilts[index % stampTilts.length]}deg`,
  } as CSSProperties;
  return (
    <li className={`obj-stamp ${logo ? "is-logo" : "is-word"}`} style={style}>
      {logo && mark ? <TechIcon id={mark} className="obj-stamp-logo" /> : null}
      <span>{tool}</span>
    </li>
  );
}

function ProjectSheet({ item, className = "", onAnimationEnd }: { item: ResumeItem; className?: string; onAnimationEnd?: () => void }) {
  return (
    <article className={`obj-folder-sheet ${className}`} onAnimationEnd={onAnimationEnd} aria-hidden={className ? true : undefined}>
      <header>
        <h2>{item.title}</h2>
        <time>{item.period}</time>
      </header>
      {item.highlight ? (
        <p className="obj-highlight">
          <strong>{item.highlight.value}</strong>
          <span>{item.highlight.label}</span>
        </p>
      ) : null}
      {item.showcase ? <p className="obj-folder-summary">{item.showcase.summary}</p> : null}
      <ul className="obj-points">
        {item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
      </ul>
      {item.stack?.length ? (
        <ul className="obj-stamps" aria-label="Tools used">
          {item.stack.map((tool, index) => <ToolStamp tool={tool} index={index} key={tool} />)}
        </ul>
      ) : null}
    </article>
  );
}

function ProjectsFolder(_: SurfaceProps) {
  const items = resumeData.projects.items;
  const { index, from, direction, go, onKeyDown, settle } = usePager(items.length);
  const tab = (position: number) => ({ "--tab": folderTabColours[position % folderTabColours.length] } as CSSProperties);
  // Forward: the old sheet turns away over the new one. Back: the new sheet turns in on top.
  const turning = from === null ? null : direction > 0 ? { item: items[from], at: from, className: "is-turning-away" } : { item: items[index], at: index, className: "is-turning-in" };

  return (
    <div className="obj-folder" style={tab(index)} onKeyDown={onKeyDown}>
      <div className="obj-folder-tabs" role="tablist" aria-label="Projects">
        {items.map((entry, entryIndex) => (
          <button type="button" role="tab" key={entry.title} aria-selected={entryIndex === index} style={tab(entryIndex)} onClick={() => go(entryIndex)}>
            {entry.short ?? entry.title}
          </button>
        ))}
      </div>
      <div className="obj-folder-stack" role="tabpanel" aria-live="polite">
        <ProjectSheet item={turning?.className === "is-turning-in" && from !== null ? items[from] : items[index]} key={`base-${index}-${from}`} />
        {turning ? (
          <div className={`obj-folder-turn ${turning.className}`} style={tab(turning.at)} key={`turn-${turning.at}-${direction}`}>
            <span className="obj-page-shadow" aria-hidden="true" />
            {/* A real sheet: printed front, blank back, hinged on the binder edge. */}
            <div className="obj-page" onAnimationEnd={(event) => { if (event.animationName.startsWith("pageTurn")) settle(); }}>
              <ProjectSheet item={turning.item} className="obj-page-front" />
              <div className="obj-page-back" aria-hidden="true" />
            </div>
          </div>
        ) : null}
      </div>
      <Pager label="More projects" index={index} items={items} go={go} />
    </div>
  );
}

/* ── Keyboard: every skill is a key; pressing one shows where it was used ─── */
export function skillList(item: ResumeItem) {
  return item.visual.nodes.length ? item.visual.nodes : item.bullets.flatMap((line) => line.split(" · "));
}

export function whereUsed(skill: string) {
  const needle = skill.toLowerCase();
  const sources = [...resumeData.work.items, ...resumeData.projects.items];
  return sources
    .filter((item) => [item.title, item.subtitle ?? "", ...(item.stack ?? []), ...item.bullets].some((text) => text.toLowerCase().includes(needle)))
    .map((item) => item.short ?? item.title);
}

/** Text equivalent of the 3D keycaps (the legends are painted on the real keys). */
function SkillsList(_: SurfaceProps) {
  return (
    <div>
      {resumeData.skills.items.map((row) => (
        <section key={row.title} aria-label={row.title}>
          <h3>{row.title}</h3>
          <ul>
            {skillList(row).map((skill) => {
              const used = whereUsed(skill);
              return <li key={skill}>{skill}{used.length ? `, used at ${used.join(", ")}` : ""}</li>;
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SkillsKeyboard(_: SurfaceProps) {
  const rows = resumeData.skills.items;
  const [pressed, setPressed] = useState<string | null>(null);
  const used = useMemo(() => (pressed ? whereUsed(pressed) : []), [pressed]);

  return (
    <div className="obj-keyboard">
      <p className="obj-keyboard-readout" aria-live="polite">
        {pressed ? (
          <>
            <strong>{pressed}</strong>
            <span>{used.length ? `Used at ${used.join(", ")}` : "Part of my everyday toolkit"}</span>
          </>
        ) : (
          <span>Press a key to see where I used it</span>
        )}
      </p>
      {rows.map((row) => (
        <section className="obj-keyboard-row" key={row.title} aria-label={row.title}>
          <h3>{row.title}</h3>
          <div className="obj-keyboard-keys">
            {skillList(row).map((skill) => (
              <button
                type="button"
                className="obj-key"
                key={skill}
                aria-pressed={pressed === skill}
                onClick={() => setPressed(pressed === skill ? null : skill)}
              >
                {skill}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ── Phone: a Pro Max–style home screen of ways to reach me ─────────────── */
function ContactPhone(_: SurfaceProps) {
  const grid = [
    { label: "Resume", href: resumePdf, icon: <FaFilePdf />, tint: "linear-gradient(160deg, #ff8a4c, #e5482a)", external: true },
    { label: "Portfolio", href: links.github, icon: <FaGithub />, tint: "linear-gradient(160deg, #3a3f4a, #15171c)", external: true },
  ];
  const dock = [
    { label: "Phone", href: links.phone, icon: <FaPhone />, tint: "linear-gradient(160deg, #5ee27a, #23b14d)" },
    { label: "Mail", href: links.email, icon: <FaEnvelope />, tint: "linear-gradient(160deg, #5fb6ff, #1a73e8)" },
    { label: "LinkedIn", href: links.linkedin, icon: <FaLinkedin />, tint: "linear-gradient(160deg, #3b8fe0, #0a5cb8)", external: true },
    { label: "GitHub", href: links.github, icon: <FaGithub />, tint: "linear-gradient(160deg, #f2f2f4, #c9cbd1)", external: true, dark: true },
  ];
  const app = (entry: { label: string; href: string; icon: React.ReactElement; tint: string; external?: boolean; dark?: boolean }, showLabel: boolean) => (
    <a
      key={entry.label}
      href={entry.href}
      className="obj-phone-app"
      aria-label={entry.label}
      style={{ "--tint": entry.tint } as CSSProperties}
      {...(entry.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <span className={`obj-phone-icon ${entry.dark ? "is-dark" : ""}`} aria-hidden="true">{entry.icon}</span>
      {showLabel ? <span>{entry.label}</span> : null}
    </a>
  );

  return (
    <div className="obj-phone">
      <p className="obj-phone-status" aria-hidden="true">
        <span>11:47</span>
        <span className="obj-phone-island" />
        <span className="obj-phone-indicators"><FaSignal /><FaWifi /><FaBatteryFull /></span>
      </p>
      <section className="obj-phone-widget" aria-label="About">
        <h2>Darren Ng</h2>
        <p>Software engineer in Singapore. Email is the fastest way to reach me.</p>
        <a href={links.email}>darren.ng577@gmail.com</a>
      </section>
      <nav className="obj-phone-grid" aria-label="Documents">{grid.map((entry) => app(entry, true))}</nav>
      <nav className="obj-phone-dock" aria-label="Contact">{dock.map((entry) => app(entry, false))}</nav>
      <span className="obj-phone-home" aria-hidden="true" />
    </div>
  );
}

/* ── Monitor: "At a glance", the elevator pitch for recruiters ────────────── */
function Overview({ onOpen }: SurfaceProps) {
  const current = resumeData.work.items[0];
  const school = resumeData.education.items[0];
  const results = [
    { item: resumeData.work.items[0], node: "work" as const },
    { item: resumeData.projects.items[0], node: "projects" as const },
    { item: resumeData.projects.items[2], node: "projects" as const },
  ].filter((entry) => entry.item?.highlight);
  const open = (node: SurfaceNode) => () => onOpen?.(node);

  return (
    <div className="obj-overview">
      <header className="obj-overview-head">
        <h2>Darren Ng</h2>
        <p>Software engineer building events platforms, data pipelines and multi-agent systems in Singapore.</p>
      </header>
      <div className="obj-overview-facts">
        <p><span>Now</span>{splitSubtitle(current.subtitle).first} at {current.short ?? current.title}</p>
        <p><span>Studying</span>{school.subtitle?.split(" · ")[0]}, {school.short}, {school.bullets[0]}</p>
      </div>
      <ol className="obj-overview-results" aria-label="Strongest results">
        {results.map(({ item, node }) => (
          <li key={item.title}>
            <button type="button" onClick={open(node)}>
              <strong>{item.highlight!.value}</strong>
              <span>{item.highlight!.label}</span>
              <small>{item.short ?? item.title}</small>
            </button>
          </li>
        ))}
      </ol>
      <nav className="obj-overview-jump" aria-label="Pick up a section">
        <button type="button" onClick={open("profile")}>Read the resume</button>
        <button type="button" onClick={open("work")}>Work</button>
        <button type="button" onClick={open("projects")}>Projects</button>
        <button type="button" onClick={open("skills")}>Skills</button>
        <button type="button" onClick={open("contact")}>Contact</button>
      </nav>
    </div>
  );
}

/* ── Certificate: one per school, flip between them ───────────────────────── */
function EducationCertificate(_: SurfaceProps) {
  const items = resumeData.education.items;
  const [index, setIndex] = useState(0);
  const item = items[index];
  const [gpa, ...honours] = item.bullets;

  return (
    <div className="obj-certificate">
      <div className="obj-certificate-switch" role="tablist" aria-label="Schools">
        {items.map((entry, entryIndex) => (
          <button type="button" role="tab" key={entry.title} aria-selected={entryIndex === index} onClick={() => setIndex(entryIndex)}>
            {entry.short ?? entry.title}
          </button>
        ))}
      </div>
      <article className="obj-certificate-frame" role="tabpanel" key={item.title}>
        <h2>{item.title}</h2>
        <p className="obj-certificate-award">{item.subtitle?.split(" · ").join(", ")}</p>
        <time>{item.period}</time>
        <div className="obj-certificate-seal" aria-label={gpa}>
          <strong>{gpa.replace("GPA ", "").split("/")[0]}</strong>
          <span>GPA</span>
        </div>
        {honours.length ? <p className="obj-certificate-honours">{honours.join(", ").replace(" · ", ", ")}</p> : null}
      </article>
    </div>
  );
}

/* ── Notebook: one page per teaching role, in pen ─────────────────────────── */
function TeachingNotebook(_: SurfaceProps) {
  return (
    <div className="obj-notebook">
      {resumeData.teaching.items.map((item) => {
        const { first: role, rest: course } = splitSubtitle(item.subtitle);
        return (
          <article className="obj-notebook-page" key={item.title}>
            <h2>{item.title}</h2>
            <p className="obj-notebook-role">{role}</p>
            <p>{course}</p>
            <p className="obj-notebook-date">{item.period}</p>
            {item.bullets.map((bullet) => <p key={bullet}>{bullet}</p>)}
          </article>
        );
      })}
    </div>
  );
}

/* ── Resume: the printed page, in hand ────────────────────────────────────── */
function ResumeEntry({ item, detailed }: { item: ResumeItem; detailed: boolean }) {
  return (
    <article className="resume-paper-entry">
      <header>
        <strong>{item.title}</strong>
        {item.period ? <time>{item.period}</time> : null}
      </header>
      {item.subtitle ? <p className="resume-paper-subtitle">{item.subtitle.split(" · ").join(", ")}</p> : null}
      {detailed && item.bullets.length ? (
        <ul>{item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      ) : null}
    </article>
  );
}

function ResumePaper({ onClose }: SurfaceProps) {
  const sections = [
    { title: "Work experience", items: resumeData.work.items, detailed: true },
    { title: "Projects and achievements", items: resumeData.projects.items, detailed: true },
    { title: "Education", items: resumeData.education.items, detailed: true },
    { title: "Additional experience", items: resumeData.teaching.items, detailed: false },
  ];

  return (
    <div className="obj-resume">
      <nav className="obj-resume-toolbar" aria-label="Resume actions">
        <a href={resumePdf} target="_blank" rel="noreferrer">Open PDF</a>
        <a href={resumePdf} download>Download</a>
        <button type="button" onClick={onClose}>Put back</button>
      </nav>
      <div className="obj-resume-page">
        <header className="resume-paper-head">
          <h2>Darren Ng Yijie</h2>
          <p>
            <a href={links.phone}>+65 8418 5922</a>
            <a href={links.email}>darren.ng577@gmail.com</a>
            <a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={links.github} target="_blank" rel="noreferrer">GitHub</a>
          </p>
        </header>
        {sections.map((section) => (
          <section className="resume-paper-section" key={section.title} aria-label={section.title}>
            <h3>{section.title}</h3>
            {section.items.map((item) => (
              <ResumeEntry item={item} detailed={section.detailed} key={`${item.title}-${item.period ?? ""}`} />
            ))}
          </section>
        ))}
        <section className="resume-paper-section" aria-label="Technical skills">
          <h3>Technical skills</h3>
          <dl className="resume-paper-skills">
            {resumeData.skills.items.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{skillList(item).join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

const surfaces: Record<SurfaceNode, (props: SurfaceProps) => React.ReactElement> = {
  overview: Overview,
  profile: ResumePaper,
  work: WorkLaptop,
  projects: ProjectsFolder,
  skills: SkillsList,
  education: EducationCertificate,
  teaching: TeachingNotebook,
  contact: ContactPhone,
};

export function ObjectSurface({ node, onClose, onOpen }: { node: SurfaceNode | null; onClose: () => void; onOpen?: (node: SurfaceNode) => void }) {
  if (!node) return null;
  const Surface = surfaces[node];
  return <Surface onClose={onClose} onOpen={onOpen} />;
}
