import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at top, #1f2a44, #090d12 65%)",
          color: "white",
          fontSize: 160,
          fontWeight: 800,
          fontFamily: "Manrope, sans-serif",
        }}
      >
        A
      </div>
    ),
    size,
  );
}
