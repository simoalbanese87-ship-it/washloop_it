import { ImageResponse } from "next/og";

export const contentType = "image/png";

/** Logo WashLoop come PNG per le email (SVG non è supportato dai client di posta).
 *  Wordmark navy + le due "oo" di Loop come bolle/oblò (gradient blu→cyan). */
export function GET() {
  const bubble = (size: number) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 36% 30%,#ffffff,#a6f1ff 30%,#00c8f0 60%,#2b7fd4)",
        display: "flex",
      }}
    />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "transparent",
          padding: "10px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-3px", color: "#0B1F3A" }}>WashL</span>
          <div style={{ display: "flex", alignItems: "center", margin: "0 2px" }}>{bubble(46)}</div>
          <div style={{ display: "flex", alignItems: "center", marginRight: 2 }}>{bubble(36)}</div>
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: "-3px", color: "#0B1F3A" }}>p</span>
        </div>
      </div>
    ),
    {
      width: 460,
      height: 120,
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
