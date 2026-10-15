"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { TechIcon, technologyMarkFor } from "./marks";
import type { ProjectShowcase, ProjectShowcaseFeature } from "./resume-data";

function SceneDashboard() {
  return (
    <div className="project-scene project-scene-dashboard" role="img" aria-label="Course dashboard preview with lessons, quizzes, progress, and moderation status">
      <div className="scene-dashboard-sidebar" aria-hidden="true">
        <span className="scene-sidebar-mark">LEARN</span>
        <i /><i /><i /><i />
      </div>
      <div className="scene-dashboard-main" aria-hidden="true">
        <div className="scene-topline"><span>COURSE HUB</span><b>LIVE</b></div>
        <div className="scene-dashboard-hero">
          <span>CONTINUE LEARNING</span>
          <strong>Learning path</strong>
          <i><b /></i>
        </div>
        <div className="scene-dashboard-grid">
          <div><span>LESSONS</span><strong>READY</strong></div>
          <div><span>QUIZZES</span><strong>READY</strong></div>
          <div className="scene-dashboard-progress"><span>PROGRESS</span><i><b /></i></div>
        </div>
        <div className="scene-dashboard-status"><span>MODERATION</span><b>READY</b></div>
      </div>
    </div>
  );
}

function SceneConversation() {
  return (
    <div className="project-scene project-scene-conversation" role="img" aria-label="AI role-play conversation preview with vector and moderation status">
      <div className="scene-ai-header" aria-hidden="true"><span>ROLE-PLAY</span><b>AI ACTIVE</b></div>
      <div className="scene-message scene-message-user" aria-hidden="true"><i />Prompt: explain the design choice</div>
      <div className="scene-ai-core" aria-hidden="true"><span>AI</span><i /><i /><i /></div>
      <div className="scene-message scene-message-ai" aria-hidden="true"><i />Try the trade-off from another angle.</div>
      <div className="scene-ai-status" aria-hidden="true"><span>VECTOR</span><span>MODERATION</span></div>
    </div>
  );
}

function SceneDelivery() {
  return (
    <div className="project-scene project-scene-delivery" role="img" aria-label="Secure delivery preview with worker queue, access control, and deployment status">
      <div className="scene-delivery-topline" aria-hidden="true"><span>DELIVERY CONTROL</span><b>DEPLOYED</b></div>
      <div className="scene-delivery-grid" aria-hidden="true">
        <div className="scene-queue"><span>WORKERS</span><i /><i /><i /><b>RABBITMQ</b></div>
        <div className="scene-shield"><span>KEYCLOAK</span><i>✓</i><b>ACCESS</b></div>
        <div className="scene-deploy"><span>CI/CD</span><strong>PASS</strong><i><b /></i><small>GITHUB ACTIONS</small></div>
      </div>
    </div>
  );
}

function SceneCamera() {
  return (
    <div className="project-scene project-scene-camera" role="img" aria-label="Live camera preview with face recognition frame and streaming status">
      <div className="scene-camera-topline" aria-hidden="true"><span>ATTENDANCE / LIVE</span><b><i /> STREAMING</b></div>
      <div className="scene-camera-viewport" aria-hidden="true">
        <span className="scene-camera-corner corner-tl" /><span className="scene-camera-corner corner-tr" />
        <span className="scene-camera-corner corner-bl" /><span className="scene-camera-corner corner-br" />
        <div className="scene-face"><i /><b>RECOGNIZED</b></div>
        <span className="scene-camera-scan" />
      </div>
      <div className="scene-camera-status" aria-hidden="true"><span>FACE DETECTION</span><b>WEBSOCKET VIDEO</b></div>
    </div>
  );
}

function SceneAnalysis() {
  return (
    <div className="project-scene project-scene-analysis" role="img" aria-label="Frame analysis preview with OpenCV, Spring Boot, and REST status">
      <div className="scene-analysis-topline" aria-hidden="true"><span>FRAME ANALYSIS</span><b>PROCESSING</b></div>
      <div className="scene-analysis-body" aria-hidden="true">
        <div className="scene-analysis-preview"><i /><i /><i /><b /></div>
        <div className="scene-analysis-readout"><span>OPENCV</span><strong>SPRING BOOT</strong><i /><i /><i /><b>REST API</b></div>
      </div>
      <div className="scene-analysis-footer" aria-hidden="true"><span>THREADS / ACTIVE</span><span>FRAME / LIVE</span></div>
    </div>
  );
}

function SceneCloud() {
  return (
    <div className="project-scene project-scene-cloud" role="img" aria-label="Cloud training preview with uploaded facial-training images and an AWS queue">
      <div className="scene-cloud-topline" aria-hidden="true"><span>TRAINING UPLOADS</span><b>QUEUE READY</b></div>
      <div className="scene-cloud-tray" aria-hidden="true">
        <div className="scene-cloud-icon"><i /><i /><i /></div>
        <strong>FACIAL-TRAINING IMAGES</strong>
        <span>ASYNC PROCESSING</span>
      </div>
      <div className="scene-cloud-services" aria-hidden="true"><span>AWS S3</span><b>SQS</b><i /></div>
    </div>
  );
}

function ProjectScene({ feature }: { feature: ProjectShowcaseFeature }) {
  switch (feature.kind) {
    case "dashboard": return <SceneDashboard />;
    case "conversation": return <SceneConversation />;
    case "delivery": return <SceneDelivery />;
    case "camera": return <SceneCamera />;
    case "analysis": return <SceneAnalysis />;
    case "cloud": return <SceneCloud />;
  }
}

function FeatureTechnologies({ feature }: { feature: ProjectShowcaseFeature }) {
  if (!feature.technologies?.length) return null;

  return (
    <div className="project-feature-technologies" aria-label="Technologies used">
      {feature.technologies.map((technology) => {
        const mark = technologyMarkFor(technology);
        return (
          <span className="project-feature-technology" key={technology}>
            {mark ? <TechIcon id={mark} /> : null}
            <span>{technology}</span>
          </span>
        );
      })}
    </div>
  );
}

export function ProjectShowcase({ showcase }: { showcase: ProjectShowcase }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const featureRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const feature = showcase.features[selectedIndex] ?? showcase.features[0];
  const panelId = "project-showcase-panel";
  const baseId = useMemo(() => `project-showcase-${showcase.features[0]?.id ?? "feature"}`, [showcase.features]);
  const selectedTabId = `${baseId}-tab-${feature.id}`;

  const focusFeature = useCallback((index: number, moveFocus = false) => {
    const nextIndex = Math.max(0, Math.min(index, showcase.features.length - 1));
    setFocusedIndex(nextIndex);
    if (moveFocus) window.requestAnimationFrame(() => featureRefs.current[nextIndex]?.focus());
  }, [showcase.features.length]);

  const handleFeatureKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (focusedIndex + 1) % showcase.features.length;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (focusedIndex - 1 + showcase.features.length) % showcase.features.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = showcase.features.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    focusFeature(nextIndex, true);
  }, [focusFeature, focusedIndex, showcase.features.length]);

  return (
    <section className="project-showcase" aria-label="Project preview">
      <div className="project-showcase-header">
        <div>
          <p className="project-showcase-kicker">Project preview</p>
          <p className="project-showcase-summary">{showcase.summary}</p>
        </div>
        <span className="project-showcase-count">{showcase.features.length} contributions</span>
      </div>

      <div className="project-showcase-layout">
        <div className="project-showcase-stage-wrap">
          <div className={`project-showcase-stage project-showcase-stage-${feature.kind}`} id={panelId} role="tabpanel" aria-labelledby={selectedTabId} aria-live="polite">
            <ProjectScene feature={feature} />
            <div className="project-scene-copy">
              <p>{feature.eyebrow}</p>
              <h4>{feature.label}</h4>
              <span>{feature.description}</span>
              <FeatureTechnologies feature={feature} />
            </div>
          </div>
        </div>

        <div className="project-feature-selector" role="tablist" aria-label="Project contributions" onKeyDown={handleFeatureKeyDown}>
          {showcase.features.map((item, index) => {
            const selected = index === selectedIndex;
            const tabId = `${baseId}-tab-${item.id}`;
            return (
              <button
                className={`project-feature ${selected ? "is-selected" : ""}`}
                key={item.id}
                type="button"
                role="tab"
                id={tabId}
                aria-selected={selected}
                aria-controls={panelId}
                aria-label={`${item.label}: ${item.description}`}
                aria-setsize={showcase.features.length}
                aria-posinset={index + 1}
                tabIndex={index === focusedIndex ? 0 : -1}
                ref={(element) => {
                  featureRefs.current[index] = element;
                }}
                onFocus={() => setFocusedIndex(index)}
                onClick={() => {
                  setFocusedIndex(index);
                  setSelectedIndex(index);
                }}
              >
                <span className="project-feature-marker" aria-hidden="true" />
                <span className="project-feature-copy">
                  <span className="project-feature-eyebrow">{item.eyebrow}</span>
                  <strong>{item.label}</strong>
                </span>
                <span className="project-feature-state" aria-hidden="true">{selected ? "Selected" : "Inspect"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
