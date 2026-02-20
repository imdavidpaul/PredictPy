import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "predictpy — ML Feature Selection"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#e4e4e7",
              letterSpacing: -3,
            }}
          >
            predict
          </span>
          <span
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#a78bfa",
              letterSpacing: -3,
            }}
          >
            py
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: "#71717a",
            letterSpacing: 1,
          }}
        >
          ML Feature Selection · Upload. Rank. Train.
        </div>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          {[
            "CSV & Excel Support",
            "Auto Feature Ranking",
            "Train ML Models",
            "Export Results",
          ].map((chip) => (
            <div
              key={chip}
              style={{
                background: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: 999,
                padding: "10px 22px",
                color: "#a1a1aa",
                fontSize: 17,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
