import { ImageResponse } from "next/og";
import { site } from "./site";

export const alt = `${site.fullName} — ${site.jobTitle} in ${site.locality}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const facts = ["SMU Software Engineering", "Intern @ EDB Singapore", "TikTok TechJam 2026 Finalist"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 78% 18%, #13233a 0%, #070b12 62%)",
          color: "#f5f7fa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid rgba(103, 232, 249, 0.45)",
              borderRadius: 14,
              color: "#67e8f9",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            DN
          </div>
          <div style={{ display: "flex", color: "#93a1b5", fontSize: 24, letterSpacing: 4, textTransform: "uppercase" }}>
            Interactive resume · {site.locality}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            {site.fullName}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 44, color: "#67e8f9" }}>{site.jobTitle}</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {facts.map((fact) => (
            <div
              key={fact}
              style={{
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                padding: "12px 24px",
                border: "1px solid rgba(231, 240, 255, 0.18)",
                borderRadius: 999,
                background: "rgba(14, 23, 37, 0.8)",
                color: "#cfd8e3",
                fontSize: 24,
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
