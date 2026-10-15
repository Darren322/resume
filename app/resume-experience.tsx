"use client";

import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  nodeOrder,
  resumeData,
  type NodeId,
  type ResumeItem,
} from "./resume-data";
import { ItemMark, NodeMark, RecordMark, TechIcon, technologyMarkFor } from "./marks";
import { ProjectShowcase } from "./project-showcase";
import { JourneyChapter } from "./career-chapter";
import { WorkstationHub } from "./workstation-hub";
import { profileLinks as externalLinks } from "./site";

function useNativeDialog(open: boolean, ref: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open, ref]);
}

function ItemHeading({ item }: { item: ResumeItem }) {
  return (
    <header className="intel-item-head">
      <div className="item-title-block">
        <div className="item-title-line">
          <ItemMark item={item} className="item-mark" />
          <h3>{item.title}</h3>
        </div>
        <div className="intel-meta">
          {item.subtitle ? <p className="intel-subtitle">{item.subtitle}</p> : null}
          {item.period ? <span className="intel-period">{item.period}</span> : null}
        </div>
      </div>
    </header>
  );
}

function ItemDetailBody({ item }: { item: ResumeItem }) {
  return (
    <>
      {item.showcase ? <ProjectShowcase showcase={item.showcase} /> : null}
      <section className="intel-proof" aria-labelledby="deliveredTitle">
        <div className="intel-proof-head">
          <h4 id="deliveredTitle">Delivered</h4>
        </div>
        <ul className="intel-outcomes" aria-label="Delivered outcomes and tools">
          {item.visual.outcomes.map((outcome) => {
            const mark = technologyMarkFor(outcome);
            return (
              <li key={outcome}>
                {mark ? <TechIcon id={mark} /> : <span className="outcome-dot" aria-hidden="true" />}
                <span>{outcome}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="engineering-notes" aria-label="Engineering notes">
        <header className="engineering-notes-copy">
          <strong>Engineering notes</strong>
          <span>{item.bullets.length} contributions</span>
        </header>
        {item.bullets.length ? (
          <ul>
            {item.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

function ItemCard({ item, hideHeader = false }: { item: ResumeItem; hideHeader?: boolean }) {
  return (
    <article className="intel-item">
      {hideHeader ? null : <ItemHeading item={item} />}
      <ItemDetailBody item={item} />
    </article>
  );
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

type CollectionMode = "shelf" | "deck" | "orbit";

type ArtifactControlProps = {
  item: ResumeItem;
  index: number;
  count: number;
  mode: CollectionMode;
  focused: boolean;
  controlRef: (element: HTMLButtonElement | null) => void;
  onFocus: (index: number) => void;
  onChoose: (index: number) => void;
};

function ArtifactControl({
  item,
  index,
  count,
  mode,
  focused,
  controlRef,
  onFocus,
  onChoose,
}: ArtifactControlProps) {
  const orbitAngle = count ? (360 / count) * index - 90 : -90;
  const orbitRadius = count > 8 ? 132 : count > 4 ? 112 : 96;
  const deckOffset = (index - (count - 1) / 2) * 58;
  const deckRotation = (index - (count - 1) / 2) * 7;
  const style = {
    "--artifact-index": index,
    "--artifact-count": count,
    "--deck-offset": `${deckOffset}px`,
    "--deck-rotation": `${deckRotation}deg`,
    "--deck-delay": `${index * 70}ms`,
    "--orbit-angle": `${orbitAngle}deg`,
    "--orbit-counter-angle": `${-orbitAngle}deg`,
    "--orbit-radius": `${orbitRadius}px`,
  } as CSSProperties;

  return (
    <button
      className={`artifact-control artifact-control-${mode}`}
      type="button"
      ref={controlRef}
      style={style}
      aria-label={`Inspect ${item.title}`}
      tabIndex={focused ? 0 : -1}
      onFocus={() => onFocus(index)}
      onClick={() => onChoose(index)}
    >
      <RecordMark item={item} className="artifact-mark" />
      <span className="artifact-inspect-cue" aria-hidden="true">Inspect</span>
    </button>
  );
}

type ArtifactCollectionProps = {
  items: ResumeItem[];
  mode: CollectionMode;
  focusedIndex: number;
  controlRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  onModeChange: (mode: CollectionMode) => void;
  onFocus: (index: number) => void;
  onChoose: (index: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

function ArtifactCollection({
  items,
  mode,
  focusedIndex,
  controlRefs,
  onModeChange,
  onFocus,
  onChoose,
  onKeyDown,
}: ArtifactCollectionProps) {
  const modes: Array<{ id: CollectionMode; label: string }> = [
    { id: "shelf", label: "Shelf" },
    { id: "deck", label: "Deck" },
    { id: "orbit", label: "Orbit" },
  ];

  const renderControl = (item: ResumeItem, index: number) => (
    <ArtifactControl
      key={`${item.title}-${item.period ?? index}`}
      item={item}
      index={index}
      count={items.length}
      mode={mode}
      focused={focusedIndex === index}
      controlRef={(element) => {
        controlRefs.current[index] = element;
      }}
      onFocus={onFocus}
      onChoose={onChoose}
    />
  );

  return (
    <section className={`artifact-collection artifact-collection-${mode}`} aria-label="Artifact collection">
      <div className="artifact-collection-toolbar">
        <div className="artifact-mode-switcher" role="group" aria-label="Artifact view">
          {modes.map((option) => (
            <button
              className={`artifact-mode-button ${mode === option.id ? "active" : ""}`}
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => onModeChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "shelf" ? (
        <div className="artifact-stage artifact-stage-shelf" role="group" aria-label="Artifact shelf" onKeyDown={onKeyDown}>
          <span className="artifact-shelf-glow" aria-hidden="true" />
          <div className="artifact-shelf-floor" aria-hidden="true" />
          <div className="artifact-shelf-grid">
            {items.map(renderControl)}
          </div>
        </div>
      ) : null}

      {mode === "deck" ? (
        <div className="artifact-stage artifact-stage-deck" role="group" aria-label="Artifact deck" onKeyDown={onKeyDown}>
          <div className="artifact-deck-stack">
            {items.map(renderControl)}
          </div>
        </div>
      ) : null}

      {mode === "orbit" ? (
        <div className="artifact-stage artifact-stage-orbit" role="group" aria-label="Artifact orbit" onKeyDown={onKeyDown}>
          <div className="artifact-orbit-center" aria-hidden="true">
            <span className="artifact-orbit-ring artifact-orbit-ring-a" />
            <span className="artifact-orbit-ring artifact-orbit-ring-b" />
            <span className="artifact-orbit-core">SCAN</span>
          </div>
          {items.map(renderControl)}
        </div>
      ) : null}

      <p className="artifact-collection-hint">Arrow keys move focus · Enter inspects</p>
    </section>
  );
}

export function ResumeExperience() {
  // The workstation is the landing experience.
  const [landingFocus, setLandingFocus] = useState(true);
  const [visited, setVisited] = useState<Set<NodeId>>(new Set());
  const [active, setActive] = useState<NodeId>("profile");
  const [collectionMode, setCollectionMode] = useState<CollectionMode>("shelf");
  const [focusedRecordIndex, setFocusedRecordIndex] = useState(0);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState<number | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const intelRef = useRef<HTMLDialogElement>(null);
  const resumeRef = useRef<HTMLDialogElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const artifactControlRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailBackRef = useRef<HTMLButtonElement>(null);
  const restoreArtifactIndexRef = useRef<number | null>(null);
  const returnToLandingRef = useRef(false);
  const motionRef = useRef({ intelOpen, resumeOpen, helpOpen });

  useNativeDialog(intelOpen, intelRef);
  useNativeDialog(resumeOpen, resumeRef);
  useNativeDialog(helpOpen, helpRef);

  useEffect(() => {
    if (!intelOpen && !resumeOpen && !helpOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [helpOpen, intelOpen, resumeOpen]);

  useEffect(() => {
    motionRef.current = { intelOpen, resumeOpen, helpOpen };
  }, [intelOpen, resumeOpen, helpOpen]);

  useEffect(() => {
    const itemCount = resumeData[active].items.length;
    setFocusedRecordIndex(0);
    setSelectedRecordIndex(itemCount > 1 ? null : 0);
    artifactControlRefs.current = [];
  }, [active]);

  const openIntel = useCallback((id: NodeId) => {
    const itemCount = resumeData[id].items.length;
    setActive(id);
    setFocusedRecordIndex(0);
    setSelectedRecordIndex(itemCount > 1 ? null : 0);
    artifactControlRefs.current = [];
    setVisited((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setIntelOpen(true);
  }, []);

  const inspectNode = useCallback(
    (id: NodeId, origin?: "workbench") => {
      setLandingFocus(false);
      returnToLandingRef.current = origin === "workbench";
      openIntel(id);
    },
    [openIntel],
  );

  const openQuickResume = useCallback(() => {
    setLandingFocus(false);
    setIntelOpen(false);
    setHelpOpen(false);
    setResumeOpen(true);
  }, []);

  const closeIntel = useCallback(() => {
    setIntelOpen(false);
    if (returnToLandingRef.current) {
      returnToLandingRef.current = false;
      setLandingFocus(true);
    }
  }, []);

  const nextNode = useCallback(() => {
    const currentIndex = nodeOrder.indexOf(active);
    const nextId = nodeOrder[(currentIndex + 1) % nodeOrder.length];
    openIntel(nextId);
  }, [active, openIntel]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable]");
      if (typing) return;

      if (key === "r" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        openQuickResume();
      }

      if (key === "?" && !motionRef.current.resumeOpen && !motionRef.current.intelOpen) {
        setHelpOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openQuickResume]);

  const activeData = resumeData[active];
  const recordCount = activeData.items.length;
  const hasCollection = recordCount > 1;
  const isChapter = true;
  const activeRecordIndex = Math.min(focusedRecordIndex, Math.max(recordCount - 1, 0));
  const isDetail = !hasCollection || selectedRecordIndex !== null;
  const selectedRecord = activeData.items[selectedRecordIndex ?? 0];

  const focusRecord = useCallback(
    (index: number, focus = false) => {
      const nextIndex = Math.max(0, Math.min(index, recordCount - 1));
      setFocusedRecordIndex(nextIndex);
      if (focus) {
        window.requestAnimationFrame(() => artifactControlRefs.current[nextIndex]?.focus());
      }
    },
    [recordCount],
  );

  const handleRecordKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!hasCollection) return;

      let nextIndex: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (activeRecordIndex + 1) % recordCount;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (activeRecordIndex - 1 + recordCount) % recordCount;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = recordCount - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        focusRecord(nextIndex, true);
      }
    },
    [activeRecordIndex, focusRecord, hasCollection, recordCount],
  );

  const chooseRecord = useCallback((index: number) => {
    setFocusedRecordIndex(index);
    setSelectedRecordIndex(index);
  }, []);

  const backToCollection = useCallback(() => {
    if (!hasCollection) return;
    const index = selectedRecordIndex ?? activeRecordIndex;
    restoreArtifactIndexRef.current = index;
    setFocusedRecordIndex(index);
    setSelectedRecordIndex(null);
  }, [activeRecordIndex, hasCollection, selectedRecordIndex]);

  useEffect(() => {
    if (!intelOpen || !hasCollection || selectedRecordIndex === null) return;
    const frame = window.requestAnimationFrame(() => detailBackRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [hasCollection, intelOpen, selectedRecordIndex]);

  useEffect(() => {
    if (!hasCollection || selectedRecordIndex !== null || restoreArtifactIndexRef.current === null) return;
    const index = Math.min(restoreArtifactIndexRef.current, recordCount - 1);
    restoreArtifactIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => artifactControlRefs.current[index]?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [hasCollection, recordCount, selectedRecordIndex]);

  const progress = (visited.size / nodeOrder.length) * 100;

  return (
    <>
      <a className="skip-link" href="#quickResume" onClick={openQuickResume}>
        Skip the interactive world
      </a>

      <div className="noise" aria-hidden="true" />
      <div className={`page-shell ${landingFocus ? "landing-focus" : ""}`} data-screen-label="Darren Ng software engineering portfolio">
        <header className="topbar">
          <button className="brand brand-button" type="button" onClick={() => { setLandingFocus(true); setIntelOpen(false); setResumeOpen(false); setHelpOpen(false); }} aria-label="Darren Ng, home">
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
          <section className="studio-card" aria-labelledby="worldTitle" data-screen-label="Explorable workbench">
            <div className="studio-header">
              <div>
                <p className="eyebrow">Interactive portfolio / Sector 01</p>
                <h1 id="worldTitle">Darren Ng — Software Engineer</h1>
              </div>
              <div className="route-progress" aria-label="Exploration progress" aria-live="polite">
                <span>{visited.size} / {nodeOrder.length} nodes</span>
                <div className="progress-track" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="world-frame">
              <WorkstationHub />
            </div>

            <footer className="studio-footer">
              <div className="control-hint">
                <span><kbd>Click</kbd> Pick up</span>
                <span><kbd>Esc</kbd> Put back</span>
                <span><kbd>R</kbd> Resume</span>
                <span><kbd>?</kbd> Help</span>
              </div>
              <p>Pick up any object on the desk, or jump to a section from the navigator.</p>
            </footer>
          </section>

          <aside className="navigator-card" aria-labelledby="navigatorTitle" data-screen-label="Career navigator">
            <div className="navigator-head">
              <div>
                <p className="eyebrow">Career navigator</p>
                <h2 id="navigatorTitle">Field notes</h2>
              </div>
              <span className="live-badge"><i /> LIVE</span>
            </div>

            <div className="identity-card">
              <div className="identity-avatar" aria-hidden="true">DN</div>
              <div>
                <h3>Darren Ng Yijie</h3>
                <p>Software engineer building dependable products, data systems, and learning tools.</p>
              </div>
            </div>

            <div className="route-list" aria-label="Jump to a career zone">
              {nodeOrder.map((id, index) => (
                <button
                  className={`route-item ${active === id ? "active" : ""} ${visited.has(id) ? "visited" : ""}`}
                  type="button"
                  key={id}
                  onClick={() => inspectNode(id)}
                >
                  <span className="route-number">{String(index).padStart(2, "0")}</span>
                  <NodeMark id={id} />
                  <span className="route-name">{resumeData[id].label}</span>
                  <span className="route-state" aria-hidden="true" />
                </button>
              ))}
            </div>

            <div className="current-signal">
              <span className="signal-label">Current signal</span>
              <strong>{activeData.zone}</strong>
              <p>{activeData.hint}</p>
            </div>

            <div className="contact-strip">
              <a href={externalLinks.email}>Email</a>
              <a href={externalLinks.github} target="_blank" rel="noreferrer">GitHub</a>
              <a href={externalLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            </div>
          </aside>
        </main>
      </div>

      <dialog
        className={`intel-dialog ${isChapter ? "intel-dialog-chapter" : ""}`}
        ref={intelRef}
        data-screen-label="Signal details"
        aria-labelledby="intelTitle"
        onClose={closeIntel}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeIntel();
        }}
      >
        <div className={`dialog-shell ${isChapter ? "dialog-shell-chapter" : ""}`}>
          <button className="icon-button dialog-close" type="button" onClick={closeIntel} aria-label="Close details">×</button>
          <div className="intel-index">{activeData.index}</div>
          <div className={`intel-content ${isChapter ? "intel-content-chapter" : ""}`}>
            {isChapter ? <JourneyChapter nodeId={active} node={activeData} onClose={closeIntel} onNext={nextNode} /> : (
              <>
                <header className="intel-panel-header">
                  {isDetail ? (
                    <>
                      <div className="detail-header-context">
                        <p className="eyebrow">{activeData.zone} / {activeData.label}</p>
                        {hasCollection ? (
                          <button className="detail-back detail-back-header" type="button" ref={detailBackRef} onClick={backToCollection}>
                            <span aria-hidden="true">←</span> Back to collection
                          </button>
                        ) : null}
                      </div>
                      <div className="detail-record-primary">
                        <RecordMark item={selectedRecord} className="detail-record-mark" />
                        <div className="detail-record-copy">
                          <h2 id="intelTitle">{selectedRecord.title}</h2>
                          <div className="detail-record-meta">
                            {selectedRecord.subtitle ? <p>{selectedRecord.subtitle}</p> : null}
                            {selectedRecord.period ? <span>{selectedRecord.period}</span> : null}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow">{activeData.zone}</p>
                      <h2 id="intelTitle">{activeData.label}</h2>
                      <p className="intel-lede">Choose an artifact to inspect.</p>
                    </>
                  )}
                </header>
                <div className="intel-scroll" tabIndex={0} aria-label="Scrollable signal details">
                  {isDetail ? (
                    <section className="record-detail" aria-label={`${activeData.label} detail`}>
                      <ItemCard item={selectedRecord} hideHeader />
                    </section>
                  ) : (
                    <ArtifactCollection
                      items={activeData.items}
                      mode={collectionMode}
                      focusedIndex={activeRecordIndex}
                      controlRefs={artifactControlRefs}
                      onModeChange={setCollectionMode}
                      onFocus={setFocusedRecordIndex}
                      onChoose={chooseRecord}
                      onKeyDown={handleRecordKeyDown}
                    />
                  )}
                </div>
              </>
            )}
          </div>
          {!isChapter ? (
            <div className="dialog-footer">
              <span>{isDetail ? `${activeData.index} / Signal acquired` : "Selection pending"}</span>
              <button className="button button-primary" type="button" onClick={nextNode}>
                Next node <span aria-hidden="true">→</span>
              </button>
            </div>
          ) : null}
        </div>
      </dialog>

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
        </div>
      </dialog>

    </>
  );
}
