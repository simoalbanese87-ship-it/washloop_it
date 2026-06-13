import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icona iOS (Add to Home Screen) generata a build time. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#24407e,#142046)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: "radial-gradient(circle at 36% 30%,#a6f1ff,#00c8f0 44%,#2b7fd4)" }} />
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "radial-gradient(circle at 36% 30%,#a6f1ff,#00c8f0 44%,#2b7fd4)" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
