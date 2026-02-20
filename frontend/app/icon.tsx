import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #7c3aed 0%, #a21caf 50%, #db2777 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Data dots */}
        {[
          { x: 6,  y: 24 },
          { x: 11, y: 19 },
          { x: 17, y: 14 },
          { x: 23, y: 9  },
        ].map(({ x, y }, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "white",
              opacity: 0.95,
            }}
          />
        ))}
        {/* Prediction dot — hollow */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 5,
            width: 4,
            height: 4,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.8)",
            background: "rgba(255,255,255,0.15)",
          }}
        />
      </div>
    ),
    { ...size },
  )
}
