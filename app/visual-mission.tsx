import {
  OrganizationMark,
  TechIcon,
  organizationMarkFor,
  technologyMarkFor,
} from "./marks";
import type { ResumeVisual, ResumeVisualKind } from "./resume-data";

function StageMark({ label, kind }: { label: string; kind: ResumeVisualKind }) {
  const organization = organizationMarkFor(label);
  if (organization) return <OrganizationMark id={organization} className="mission-mark" />;

  const technology = technologyMarkFor(label);
  if (technology) return <TechIcon id={technology} className="mission-mark" />;

  return (
    <span className={`mission-glyph mission-glyph-${kind}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function VisualMission({ visual }: { visual: ResumeVisual }) {
  return (
    <section className={`mission-card mission-card-${visual.kind}`} aria-label={visual.label}>
      <div className="mission-card-head">
        <span className="mission-card-kicker">System map</span>
        <span className="mission-card-label">{visual.label}</span>
      </div>
      <ul className={`mission-schematic mission-schematic-${visual.kind}`} aria-label={`${visual.label}: ${visual.nodes.join(", ")}`}>
        {visual.nodes.map((node) => (
          <li className="mission-stage" key={node}>
            <StageMark label={node} kind={visual.kind} />
            <span className="mission-stage-label">{node}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
