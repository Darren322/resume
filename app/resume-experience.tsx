"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resumeData, type NodeId } from "./resume-data";
import { ItemMark, TechIcon, technologyMarkFor } from "./marks";
import { WorkstationHub } from "./workstation-hub";
import { modelCredits, profileLinks as externalLinks } from "./site";

function useNativeDialog(open: boolean, ref: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, ref]);
}

function ResumeSection({ id }: { id: Exclude<NodeId, "profile" | "contact"> }) {
  const titles: Record<Exclude<NodeId, "profile" | "contact">, string> = {
    work: "Work experience",
    projects: "Selected projects",
    education: "Education",
    teaching: "Teaching experience",
    skills: "Technical skills",
  };
  const data = resumeData[id];

  if (id === "skills") {
    return (
      <section className="resume-section" data-section={id}>
        <h3 className="resume-section-title">{titles[id]}</h3>
        {data.items.map((item) => (
          <div className="skills-group" key={item.title}>
            <strong>{item.title}</strong>
            <div className="resume-tags">
              {item.bullets[0].split(" · ").map((skill) => {
                const mark = technologyMarkFor(skill);
                return (
                  <span className="resume-tag" key={skill}>
                    {mark ? <TechIcon id={mark} /> : null}
                    <span className="resume-tag-label">{skill}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section className="resume-section" data-section={id}>
      <h3 className="resume-section-title">{titles[id]}</h3>
      {data.items.map((item) => (
        <article className="resume-entry" key={`${item.title}-${item.period}`}>
          <div className="resume-entry-head">
            <div className="item-title-block">
              <div className="item-title-line">
                <ItemMark item={item} className="item-mark" />
                <h4>{item.title}</h4>
              </div>
              <p className="resume-entry-subtitle">{item.subtitle}</p>
            </div>
            <span className="resume-entry-period">{item.period}</span>
          </div>
          <ul>
            {item.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

export function ResumeExperience() {
  const [resumeOpen, setResumeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const resumeRef = useRef<HTMLDialogElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const resumeOpenRef = useRef(resumeOpen);

  useNativeDialog(resumeOpen, resumeRef);
  useNativeDialog(helpOpen, helpRef);

  useEffect(() => {
    resumeOpenRef.current = resumeOpen;
    if (!resumeOpen && !helpOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [helpOpen, resumeOpen]);

  const openQuickResume = useCallback(() => {
    setHelpOpen(false);
    setResumeOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]");
      if (typing) return;

      if (key === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        openQuickResume();
      }

      if (key === "?" && !resumeOpenRef.current) {
        setHelpOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openQuickResume]);

  return (
    <>
      <a className="skip-link" href="#quickResume" onClick={openQuickResume}>
        Skip the interactive world
      </a>

      <div className="noise" aria-hidden="true" />
      <div className="page-shell landing-focus" data-screen-label="Darren Ng software engineering portfolio">
        <header className="topbar">
          <button className="brand brand-button" type="button" onClick={() => { setResumeOpen(false); setHelpOpen(false); }} aria-label="Darren Ng, home">
            <span className="brand-mark" aria-hidden="true">DN</span>
            <span className="brand-copy">
              <strong>Darren Ng</strong>
              <small>Software Engineer</small>
            </span>
          </button>

          <div className="system-status" aria-label="System online">
            <span className="status-light" />
            <span>Available in Singapore</span>
          </div>

          <nav className="header-actions" aria-label="Primary navigation">
            <a href={externalLinks.email} className="text-link">Email</a>
            <button
              className="button button-primary"
              type="button"
              aria-controls="quickResume"
              aria-haspopup="dialog"
              onClick={openQuickResume}
            >
              Quick resume <span aria-hidden="true">↗</span>
            </button>
          </nav>
        </header>

        <main id="main" className="main-layout" data-screen-label="Interactive workbench">
          <section className="studio-card" aria-label="Darren Ng — Software Engineer" data-screen-label="Explorable workbench">
            <h1 className="visually-hidden">Darren Ng — Software Engineer</h1>
            <div className="world-frame">
              <WorkstationHub />
            </div>
          </section>
        </main>
      </div>

      <dialog
        className="resume-dialog"
        id="quickResume"
        ref={resumeRef}
        data-screen-label="Quick Resume"
        aria-labelledby="resumeTitle"
        onClose={() => setResumeOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setResumeOpen(false);
        }}
      >
        <div className="resume-shell">
          <header className="resume-header">
            <div>
              <p className="eyebrow">Quick resume / Read mode</p>
              <h2 id="resumeTitle">Darren Ng Yijie</h2>
              <p>Software Engineering · Singapore</p>
              <p className="resume-profile-summary">{resumeData.profile.lede}</p>
            </div>
            <div className="resume-actions">
              <a className="button button-quiet" href="/assets/Darren_Ng_YJ_Resume.pdf" download>Download PDF</a>
              <button className="icon-button" type="button" onClick={() => setResumeOpen(false)} aria-label="Close resume">×</button>
            </div>
          </header>
          <div className="resume-contact">
            <a href="tel:+6584185922">+65 8418 5922</a>
            <a href={externalLinks.email}>darren.ng577@gmail.com</a>
            <a href={externalLinks.github} target="_blank" rel="noreferrer">github.com/Darren322</a>
            <a href={externalLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
          <div className="resume-body">
            <ResumeSection id="work" />
            <ResumeSection id="projects" />
            <ResumeSection id="education" />
            <ResumeSection id="teaching" />
            <ResumeSection id="skills" />
          </div>
        </div>
      </dialog>

      <dialog
        className="help-dialog"
        id="helpDialog"
        ref={helpRef}
        data-screen-label="Control manual"
        aria-labelledby="helpTitle"
        onClose={() => setHelpOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }}
      >
        <div className="help-shell">
          <button className="icon-button dialog-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close controls">×</button>
          <p className="eyebrow">Control manual</p>
          <h2 id="helpTitle">Navigate your way.</h2>
          <div className="help-grid">
            <div><kbd>Click / Tap</kbd><span>Pick up an object on the desk</span></div>
            <div><kbd>Tab</kbd><span>Move between desk objects</span></div>
            <div><kbd>Enter / Space</kbd><span>Pick up the focused object</span></div>
            <div><kbd>Esc</kbd><span>Put it back / close panel</span></div>
            <div><kbd>Scroll / Pinch</kbd><span>Zoom the desk</span></div>
            <div><kbd>R</kbd><span>Open quick resume</span></div>
          </div>
          <details className="model-credits">
            <summary>3D model credits</summary>
            <ul>
              {modelCredits.map((credit) => (
                <li key={credit.url}>
                  {credit.object}: <a href={credit.url} target="_blank" rel="noreferrer">{credit.title}</a> by {credit.author}, CC BY 4.0
                </li>
              ))}
            </ul>
          </details>
        </div>
      </dialog>

    </>
  );
}
