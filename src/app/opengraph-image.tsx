import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "ATSly — Make your resume ATS-ready.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");

export default async function OpengraphImage() {
  const [semiBold, regular, light] = await Promise.all([
    readFile(join(fontDir, "Geist-SemiBold.ttf")),
    readFile(join(fontDir, "Geist-Regular.ttf")),
    readFile(join(fontDir, "Geist-Light.ttf")),
  ]);

  // Ring geometry for a score of 82 at 220px.
  const ring = { size: 220, stroke: 8, value: 82 };
  const r = (ring.size - ring.stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "80px 96px",
        background: "#FFFFFF",
        fontFamily: "Geist",
        color: "#0F172A",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          <svg width="34" height="34" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7.5" stroke="#CBD5E1" strokeWidth="2.5" />
            <path
              d="M10 2.5a7.5 7.5 0 1 1-7.5 7.5"
              stroke="#0F172A"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          ATSly
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 56,
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          <span>Make your resume</span>
          <span>ATS-ready.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 30,
            fontWeight: 400,
            color: "#475569",
            lineHeight: 1.4,
          }}
        >
          Explainable scores, job matching and specific recommendations.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: ring.size,
          height: ring.size,
        }}
      >
        <svg
          width={ring.size}
          height={ring.size}
          viewBox={`0 0 ${ring.size} ${ring.size}`}
        >
          <circle
            cx={ring.size / 2}
            cy={ring.size / 2}
            r={r}
            fill="none"
            stroke="#F1F5F9"
            strokeWidth={ring.stroke}
          />
          <circle
            cx={ring.size / 2}
            cy={ring.size / 2}
            r={r}
            fill="none"
            stroke="#0F172A"
            strokeWidth={ring.stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference * (1 - ring.value / 100)}`}
            transform={`rotate(-90 ${ring.size / 2} ${ring.size / 2})`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: ring.size,
            height: ring.size,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 300,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {ring.value}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#64748B", marginTop: 6 }}>
            / 100
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: semiBold, weight: 600, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: light, weight: 300, style: "normal" },
      ],
    },
  );
}
