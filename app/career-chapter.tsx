"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RecordMark, TechIcon } from "./marks";
import type { NodeId, ResumeItem, ResumeNode } from "./resume-data";
import { ContactActions, JourneyScene } from "./journey-scenes";
import { journeyConfigFor } from "./journey-config";

gsap.registerPlugin(ScrollTrigger);

type ChapterPose = "travelling" | "thinking" | "pointing" | "celebrating";

type ChapterCompanion = {
  pose: ChapterPose;
  speech: string;
};

type CareerChapterProps = {
  nodeId: NodeId;
  node: ResumeNode;
  onClose: () => void;
  onNext: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function domId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "record";
}

function useCursorGaze(chapterRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const chapter = chapterRef.current;
    const guide = chapter?.querySelector<HTMLElement>("[data-chapter-guide]");
    if (!chapter || !guide || !enabled) return;

    const media = window.matchMedia("(pointer: coarse)");
    if (media.matches) return;

    const avatar = guide.querySelector<HTMLElement>(".chapter-companion-avatar") ?? guide;
    let avatarRect = avatar.getBoundingClientRect();
    let frame = 0;
    let lastTime = performance.now();
    let visible = !document.hidden;
    const target = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    const lastPublished = { x: Number.NaN, y: Number.NaN };

    const publish = (x: number, y: number) => {
      if (x === lastPublished.x && y === lastPublished.y) return;
      lastPublished.x = x;
      lastPublished.y = y;
      guide.style.setProperty("--gaze-x", String(x));
      guide.style.setProperty("--gaze-y", String(y));
    };

    const recordPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const guideCenterX = avatarRect.left + avatarRect.width / 2;
      const guideCenterY = avatarRect.top + avatarRect.height / 2;
      const viewportWidth = Math.max(window.innerWidth * 0.5, 1);
      const viewportHeight = Math.max(window.innerHeight * 0.5, 1);
      target.x = clamp((event.clientX - guideCenterX) / viewportWidth, -1, 1);
      target.y = clamp((event.clientY - guideCenterY) / viewportHeight, -1, 1);
    };

    const resetPointer = () => {
      target.x = 0;
      target.y = 0;
    };

    const tick = (time: number) => {
      if (!visible) return;
      const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 1 / 30);
      lastTime = time;
      const alpha = 1 - Math.pow(1 - 0.055, dt * 60);
      smooth.x += (target.x - smooth.x) * alpha;
      smooth.y += (target.y - smooth.y) * alpha;
      publish(Math.round(smooth.x * 1000) / 1000, Math.round(smooth.y * 1000) / 1000);
      frame = window.requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      visible = !document.hidden;
      if (!visible) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      lastTime = performance.now();
      frame = window.requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(() => {
      avatarRect = avatar.getBoundingClientRect();
    });
    resizeObserver.observe(chapter);
    resizeObserver.observe(avatar);
    chapter.addEventListener("pointermove", recordPointer, { passive: true });
    chapter.addEventListener("pointerleave", resetPointer, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      chapter.removeEventListener("pointermove", recordPointer);
      chapter.removeEventListener("pointerleave", resetPointer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      guide.style.removeProperty("--gaze-x");
      guide.style.removeProperty("--gaze-y");
    };
  }, [chapterRef, enabled]);
}

function companionFor(nodeId: NodeId, index: number): ChapterCompanion {
  const speech = journeyConfigFor(nodeId).companion[index] ?? journeyConfigFor(nodeId).companion[0] ?? "Reading the current chapter.";
  const poses: ChapterPose[] = ["pointing", "thinking", "travelling", "celebrating"];
  return { pose: poses[index % poses.length], speech };
}

function ChapterCompanion({ companion }: { companion: ChapterCompanion }) {
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    setAcknowledging(false);
  }, [companion.pose, companion.speech]);

  useEffect(() => {
    if (!acknowledging) return;
    const timeout = window.setTimeout(() => setAcknowledging(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [acknowledging]);

  const speech = acknowledging ? `Signal received. ${companion.speech}` : companion.speech;

  return (
    <aside className={`chapter-companion chapter-companion-${companion.pose} ${acknowledging ? "chapter-companion-acknowledging" : ""}`} aria-live="polite">
      <div className="chapter-companion-speech">{speech}</div>
      <button
        className="chapter-companion-avatar"
        type="button"
        aria-label="Ask the lab companion about this scene"
        onClick={() => setAcknowledging(true)}
      >
        <svg className="chapter-companion-robot" viewBox="0 0 132 150" focusable="false">
          <defs>
            <linearGradient id="robotShell" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#f8fbff" />
              <stop offset="0.58" stopColor="#cbd8e4" />
              <stop offset="1" stopColor="#8fa6b8" />
            </linearGradient>
            <linearGradient id="robotFace" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#243d72" />
              <stop offset="1" stopColor="#101b42" />
            </linearGradient>
          </defs>
          <ellipse className="robot-shadow" cx="66" cy="140" rx="38" ry="7" />
          <g className="chapter-robot">
            <path className="chapter-robot-thruster chapter-robot-thruster-left" d="M20 112 C9 119 9 130 18 137" />
            <path className="chapter-robot-thruster chapter-robot-thruster-right" d="M112 112 C123 119 123 130 114 137" />
            <path className="chapter-robot-arm chapter-robot-arm-left" d="M28 78 C15 83 14 100 24 108" />
            <path className="chapter-robot-arm chapter-robot-arm-right" d="M104 78 C117 83 118 100 108 108" />
            <g className="robot-body-group">
              <ellipse className="robot-body" cx="66" cy="103" rx="27" ry="34" fill="url(#robotShell)" />
              <rect className="robot-neck" x="57" y="70" width="18" height="10" rx="5" />
            </g>
            <g className="robot-head-group">
              <rect className="robot-head" x="20" y="17" width="92" height="65" rx="28" fill="url(#robotShell)" />
              <rect className="robot-face" x="31" y="29" width="70" height="42" rx="16" fill="url(#robotFace)" />
              <g className="robot-eye-layer">
                <circle className="robot-eye robot-eye-left" cx="52" cy="49" r="5" />
                <circle className="robot-eye robot-eye-right" cx="80" cy="49" r="5" />
              </g>
              <path className="robot-mouth" d="M57 59 Q66 65 75 59" />
              <g className="robot-ellipsis"><circle cx="57" cy="60" r="2" /><circle cx="66" cy="60" r="2" /><circle cx="75" cy="60" r="2" /></g>
            </g>
            <path className="robot-beam" d="M110 82 L130 72" />
            <path className="robot-spark robot-spark-a" d="M17 18 l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
            <path className="robot-spark robot-spark-b" d="M116 34 l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
          </g>
        </svg>
      </button>
      <span className="chapter-companion-caption">LAB COMPANION / {companion.pose.toUpperCase()}</span>
    </aside>
  );
}

function EventScene() {
  return (
    <div className="chapter-scene chapter-scene-events" role="img" aria-label="Event platform scene aggregating GEVME, Hivebrite, Salesforce, and Luma into a Next.js platform for GovTech Airbase">
      <div className="chapter-scene-grid" aria-hidden="true" />
      <div className="chapter-event-sources" aria-hidden="true">
        <span>GEVME</span><span>HIVEBRITE</span><span>SALESFORCE</span><span>LUMA</span>
      </div>
      <div className="chapter-event-core" aria-hidden="true">
        <small>EVENT PLATFORM</small>
        <span className="chapter-scene-tech"><TechIcon id="nextjs" /><strong>Next.js</strong></span>
        <i /><b /><em />
      </div>
      <div className="chapter-event-destination" aria-hidden="true">
        <span>GOVTECH</span><strong>AIRBASE</strong><TechIcon id="gitlab" />
      </div>
      <div className="chapter-scene-note" aria-hidden="true">events / data / delivery</div>
    </div>
  );
}

function SelfHostedScene() {
  return (
    <div className="chapter-scene chapter-scene-self-hosted" role="img" aria-label="Self-hosted company platform scene with React, Express.js, Supabase, Raspberry Pi, and Vercel">
      <div className="chapter-browser-bar" aria-hidden="true"><span /><span /><span /><b>YJS / COMPANY SITE</b></div>
      <div className="chapter-browser-body" aria-hidden="true">
        <div className="chapter-browser-hero"><small>PRODUCT DELIVERY</small><strong>Build once.<br />Run deliberately.</strong><i /></div>
        <div className="chapter-browser-stack">
          <span><TechIcon id="react" /><b>REACT</b><small>VIKE · TAILWIND CSS</small></span>
          <span><TechIcon id="express" /><b>EXPRESS.JS</b><small>SUPABASE</small></span>
          <span className="chapter-stack-pi">
            <svg className="chapter-pi-board" viewBox="0 0 100 58" aria-hidden="true" focusable="false">
              <rect className="pi-board-shell" x="5" y="7" width="90" height="44" rx="5" />
              <rect className="pi-board-chip" x="38" y="18" width="24" height="21" rx="2" />
              <path className="pi-board-trace" d="M12 17h18M70 17h18M12 42h18M70 42h18" />
              <g className="pi-board-pins"><rect x="12" y="10" width="3" height="5" /><rect x="19" y="10" width="3" height="5" /><rect x="26" y="10" width="3" height="5" /><rect x="73" y="10" width="3" height="5" /><rect x="80" y="10" width="3" height="5" /><rect x="87" y="10" width="3" height="5" /></g>
              <rect className="pi-board-port" x="5" y="24" width="7" height="11" rx="1" /><rect className="pi-board-port" x="88" y="24" width="7" height="11" rx="1" />
            </svg>
            <b>Raspberry Pi</b><small>PM2 · UFW</small>
          </span>
        </div>
      </div>
      <div className="chapter-host-badge" aria-hidden="true"><span>SELF-HOSTED</span><b>SSL</b><small>CLOUDFLARE</small></div>
      <div className="chapter-scene-note" aria-hidden="true">frontend / backend / deployment</div>
    </div>
  );
}

function ApprovalScene() {
  return (
    <div className="chapter-scene chapter-scene-approvals" role="img" aria-label="Manual forms transformed into a multi-level approval workflow with Power Apps, Power Automate, and SharePoint">
      <div className="chapter-paper-stack" aria-hidden="true"><span /><span /><span /><b>20+</b><small>FORMS</small></div>
      <div className="chapter-approval-panel" aria-hidden="true">
        <small><span className="chapter-power-mark">PP</span> APPROVAL QUEUE</small>
        <strong>HR REQUEST</strong>
        <span><i /> POWER APPS</span>
        <span><i /> POWER AUTOMATE</span>
        <span><i /> SHAREPOINT</span>
      </div>
      <div className="chapter-approval-stamp" aria-hidden="true">APPROVED</div>
      <div className="chapter-scene-note" aria-hidden="true">manual forms / automation / approvals</div>
    </div>
  );
}

function ArchiveScene({ item, index }: { item: ResumeItem; index: number }) {
  const smu = index === 0;
  return (
    <div className={`chapter-scene chapter-scene-archive ${smu ? "chapter-scene-archive-smu" : "chapter-scene-archive-nyp"}`} role="img" aria-label={`${item.title} academic record with ${item.bullets.join(" and ")}`}>
      <div className="chapter-archive-shelf" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="chapter-archive-card" aria-hidden="true">
        <small>{smu ? "SMU / ACADEMIC ARCHIVE" : "NYP / ACADEMIC ARCHIVE"}</small>
        <strong>{smu ? "BSc" : "DIPLOMA"}</strong>
        <span>{smu ? "SOFTWARE ENGINEERING" : "ENGINEERING + BUSINESS"}</span>
        <i />
      </div>
      <div className="chapter-archive-token" aria-hidden="true">
        <b>{smu ? "3.61" : "3.71"}</b><small>GPA / 4.00</small>
      </div>
      <div className="chapter-scene-note" aria-hidden="true">credential / record / recognition</div>
    </div>
  );
}

function ChapterScene({ nodeId, item, index }: { nodeId: NodeId; item: ResumeItem; index: number }) {
  if (nodeId === "education") return <ArchiveScene item={item} index={index} />;
  if (index === 0) return <EventScene />;
  if (index === 1) return <SelfHostedScene />;
  return <ApprovalScene />;
}

function ChapterMarkLine({ item }: { item: ResumeItem }) {
  return (
    <div className="chapter-mark-line">
      <RecordMark item={item} className="chapter-record-mark" />
      <span>Verified record</span>
    </div>
  );
}

export function JourneyChapter({ nodeId, node, onClose, onNext }: CareerChapterProps) {
  const chapterRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [userReducedMotion, setUserReducedMotion] = useState(false);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [motionPreferenceLoaded, setMotionPreferenceLoaded] = useState(false);
  const selectorRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const focusSelectorRef = useRef(false);
  const reducedMotion = userReducedMotion || systemReducedMotion;
  const config = journeyConfigFor(nodeId);
  const [selectedArtifact, setSelectedArtifact] = useState(0);

  useCursorGaze(chapterRef, !reducedMotion);

  useEffect(() => {
    try {
      setUserReducedMotion(window.localStorage.getItem("midnight-lab-reduce-motion") === "true");
    } catch {
      // Storage can be unavailable in private browsing; the visible toggle still works.
    }
    setMotionPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!motionPreferenceLoaded) return;
    try {
      window.localStorage.setItem("midnight-lab-reduce-motion", String(userReducedMotion));
    } catch {
      // The preference is non-essential and remains session-local when storage is blocked.
    }
  }, [motionPreferenceLoaded, userReducedMotion]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const root = chapterRef.current;
    const scroller = scrollRef.current;
    if (!root || !scroller) return;

    let refreshFrame = 0;
    const ctx = gsap.context(() => {
      // Query within this chapter only. The page can keep a legacy map behind
      // the chapter, and global selectors otherwise create hidden cross-talk.
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter-section]"));
      const revealItems = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter-reveal]"));
      const sceneItems = Array.from(root.querySelectorAll<HTMLElement>("[data-chapter-scene]"));
      const progress = root.querySelector<HTMLElement>("[data-chapter-progress]");
      const content = root.querySelector<HTMLElement>(".chapter-scroll-content");

      sections.forEach((section, index) => {
        ScrollTrigger.create({
          trigger: section,
          scroller,
          start: "top 66%",
          end: "bottom 34%",
          onEnter: () => setActiveSection(index),
          onEnterBack: () => setActiveSection(index),
        });
      });

      if (progress && content) {
        gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });
        ScrollTrigger.create({
          trigger: content,
          scroller,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => gsap.set(progress, { scaleX: self.progress }),
        });
      }

      if (reducedMotion) {
        gsap.set(revealItems, { clearProps: "all", autoAlpha: 1 });
        gsap.set(sceneItems, { clearProps: "all", autoAlpha: 1 });
      } else {
        revealItems.forEach((element, index) => {
          gsap.fromTo(element, { autoAlpha: 0, y: 28 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.72,
            delay: Math.min(index * 0.035, 0.18),
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              scroller,
              start: "top 84%",
              once: true,
            },
            clearProps: "opacity,visibility,transform",
          });
        });

        sceneItems.forEach((element) => {
          gsap.fromTo(element, { autoAlpha: 0.35, clipPath: "inset(0 100% 0 0)" }, {
            autoAlpha: 1,
            clipPath: "inset(0 0% 0 0)",
            duration: 1.05,
            ease: "power4.out",
            scrollTrigger: {
              trigger: element,
              scroller,
              start: "top 82%",
              once: true,
            },
            clearProps: "opacity,visibility,clip-path,transform",
          });
        });

        // ScrollTrigger may initialize after the first viewport has already
        // settled (especially when a native dialog opens). Never leave the
        // first readable record stranded behind an inline opacity.
        window.setTimeout(() => {
          [...revealItems, ...sceneItems].forEach((element) => {
            if (element.getBoundingClientRect().top < window.innerHeight * 1.2) {
              gsap.set(element, { autoAlpha: 1, clearProps: "opacity,visibility,transform,clip-path" });
            }
          });
        }, 900);
      }

      refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    }, root);

    return () => {
      cancelAnimationFrame(refreshFrame);
      ctx.revert();
    };
  }, [reducedMotion, node.items.length, selectedArtifact]);

  const companion = companionFor(nodeId, activeSection);
  const chapterTitle = config.title;
  const chapterIntro = config.intro;
  const visibleItems = config.selectionMode ? [node.items[selectedArtifact] ?? node.items[0]] : node.items;

  useEffect(() => {
    if (!focusSelectorRef.current) return;
    focusSelectorRef.current = false;
    selectorRefs.current[selectedArtifact]?.focus();
  }, [selectedArtifact]);

  return (
    <section className={`career-chapter ${reducedMotion ? "chapter-motion-static" : ""}`} ref={chapterRef} data-screen-label={`${node.label} cinematic chapter`}>
      <header className="chapter-nav">
        <button className="chapter-nav-back" type="button" onClick={onClose}><span aria-hidden="true">←</span> Back to lab</button>
        <div className="chapter-nav-status" aria-live="polite">
          <span>{node.zone}</span>
          <span className="chapter-nav-progress"><i data-chapter-progress /><b>{String(activeSection + 1).padStart(2, "0")} / {String(node.items.length).padStart(2, "0")}</b></span>
        </div>
        <button
          className={`chapter-motion-toggle ${reducedMotion ? "active" : ""}`}
          type="button"
          aria-pressed={reducedMotion}
          disabled={systemReducedMotion}
          onClick={() => setUserReducedMotion((current) => !current)}
        >
          <span aria-hidden="true">◌</span> {systemReducedMotion ? "System reduced" : userReducedMotion ? "Enable motion" : "Reduce motion"}
        </button>
      </header>

      <div className="chapter-guide-layer" data-chapter-guide>
        <ChapterCompanion companion={companion} />
      </div>

      <div className="chapter-scroll" ref={scrollRef} tabIndex={0} aria-label={`${node.label} chapter scroll area`}>
        <div className="chapter-scroll-content">
          <header className="chapter-intro">
          <p className="eyebrow">{node.index} / {node.zone}</p>
          <h1 id="intelTitle">{chapterTitle}</h1>
          <p>{chapterIntro}</p>
          {config.selectionMode ? (
            <div className="journey-selector" role="tablist" aria-label={config.selectionMode === "projects" ? "Project artifacts" : config.selectionMode === "skills" ? "Skill categories" : `${node.label} records`}>
              {node.items.map((item, index) => (
                <button
                  className={`journey-selector-item ${selectedArtifact === index ? "active" : ""}`}
                  key={`${item.title}-${item.period ?? index}`}
                  type="button"
                  role="tab"
                  id={`${nodeId}-selector-${index}`}
                  aria-selected={selectedArtifact === index}
                  aria-controls={`${nodeId}-artifact-panel`}
                  tabIndex={selectedArtifact === index ? 0 : -1}
                  onClick={() => { setSelectedArtifact(index); setActiveSection(0); }}
                  ref={(element) => { selectorRefs.current[index] = element; }}
                  onKeyDown={(event) => {
                    const moveTo = (nextIndex: number) => {
                      event.preventDefault();
                      focusSelectorRef.current = true;
                      setSelectedArtifact(nextIndex);
                      setActiveSection(0);
                    };
                    if (event.key === "ArrowRight" || event.key === "ArrowDown") moveTo((index + 1) % node.items.length);
                    if (event.key === "ArrowLeft" || event.key === "ArrowUp") moveTo((index - 1 + node.items.length) % node.items.length);
                    if (event.key === "Home") moveTo(0);
                    if (event.key === "End") moveTo(node.items.length - 1);
                  }}
                >
                  <RecordMark item={item} className="journey-selector-mark" />
                  <span><strong>{item.title}</strong><small>{item.subtitle ?? item.period}</small></span>
                </button>
              ))}
            </div>
          ) : null}
          <span className="chapter-scroll-cue">Scroll through the record <b aria-hidden="true">↓</b></span>
          </header>

          {visibleItems.map((item, index) => {
          const sourceIndex = config.selectionMode ? selectedArtifact : index;
          const recordId = `${nodeId}-${sourceIndex}-${domId(item.title)}`;
          const titleId = `${recordId}-title`;
          const detailsId = `${recordId}-details`;
          const proofId = `${recordId}-proof`;
          const selectorId = `${nodeId}-selector-${sourceIndex}`;
          return (
            <article
              className="chapter-record"
              data-chapter-section
              data-record-priority="primary"
              key={`${item.title}-${item.period}-${sourceIndex}`}
              aria-describedby={`${recordId}-takeaway`}
              role={config.selectionMode ? "tabpanel" : undefined}
              id={config.selectionMode ? `${nodeId}-artifact-panel` : undefined}
              aria-labelledby={config.selectionMode ? `${selectorId} ${titleId}` : titleId}
            >
              <div className="chapter-record-scene" data-chapter-reveal data-chapter-scene>
                <JourneyScene nodeId={nodeId} item={item} index={sourceIndex} />
              </div>
              <div className="chapter-record-copy" data-chapter-reveal>
                <ChapterMarkLine item={item} />
                <p className="chapter-record-kicker">{nodeId === "projects" ? "What I built" : "What I worked on"} <span>{item.period}</span></p>
                <h2 id={titleId}>{item.title}</h2>
                <p className="chapter-record-subtitle">{item.subtitle}</p>
                <p className="chapter-record-takeaway" id={`${recordId}-takeaway`}>
                  {nodeId === "projects" && item.showcase ? item.showcase.summary : item.visual.label}
                </p>
                {nodeId === "profile" || nodeId === "education" ? (
                  <div className="chapter-paper-actions" aria-label="Resume document actions">
                    <a href="/assets/Darren_Ng_YJ_Resume.pdf" target="_blank" rel="noreferrer">Open readable PDF</a>
                    <a href="/assets/Darren_Ng_YJ_Resume.pdf" download>Download PDF</a>
                  </div>
                ) : null}
                <section className="chapter-field-notes" aria-labelledby={detailsId}>
                  <header className="chapter-field-notes-head">
                    <h3 id={detailsId}>Details</h3>
                    <span>{item.bullets.length} verified {item.bullets.length === 1 ? "detail" : "details"}</span>
                  </header>
                  {item.bullets.length ? (
                    <ul>
                      {item.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                    </ul>
                  ) : null}
                </section>
                <div className="chapter-record-proof" id={proofId} role="group" aria-label="Proof points">
                  <span>Proof</span>
                  {item.visual.outcomes.map((outcome) => <span key={outcome}>{outcome}</span>)}
                </div>
              </div>
            </article>
            );
          })}

          {nodeId === "contact" ? <ContactActions /> : null}

          <footer className="chapter-handoff" data-chapter-reveal>
            <span>Chapter complete</span>
            <button className="button button-primary" type="button" onClick={onNext}>Next node <span aria-hidden="true">→</span></button>
          </footer>
        </div>
      </div>
    </section>
  );
}
