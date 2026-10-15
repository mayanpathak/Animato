import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, Easing } from "remotion";

export const DURATION_SECONDS = 45;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Color constants
  const COLOR_BG = "#090d1a";
  const COLOR_PANEL = "rgba(18, 26, 47, 0.75)";
  const COLOR_BORDER = "rgba(255, 255, 255, 0.12)";
  const COLOR_SIDE_A = "#38bdf8"; // Cyan / Sky blue
  const COLOR_SIDE_B = "#34d399"; // Emerald green
  const COLOR_SIDE_C = "#fbbf24"; // Warm gold / Hypotenuse
  const COLOR_TEXT_PRIMARY = "#f8fafc";
  const COLOR_TEXT_MUTED = "#94a3b8";

  // Triangle geometry (scaled: 1 unit = 60px)
  // Vertex C (right angle) at (540, 620)
  // Vertex A (top) at (540, 440) -> height = 180 (side a = 3)
  // Vertex B (right) at (780, 620) -> base = 240 (side b = 4)
  // Hypotenuse AB length = 300 (side c = 5)
  const X0 = 540;
  const Y0 = 620;
  const sideALength = 180; // 3 * 60
  const sideBLength = 240; // 4 * 60

  // -------------------------------------------------------------
  // ANIMATION TIMINGS (30 fps * 45s = 1350 frames)
  // -------------------------------------------------------------
  // Scene 1: Title Screen (0 -> 130)
  const titleOpacity = interpolate(frame, [0, 20, 110, 130], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleScale = interpolate(frame, [0, 30], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Scene 2: Triangle Introduction (130 -> 420)
  const mainWorkspaceOpacity = interpolate(frame, [130, 150, 1130, 1150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Triangle draw progress (frame 150 -> 210)
  const triangleDrawProgress = interpolate(frame, [150, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const trianglePerimeter = 180 + 240 + 300; // 720
  const triangleStrokeDashoffset = (1 - triangleDrawProgress) * trianglePerimeter;

  // Right angle indicator appear (frame 200 -> 220)
  const rightAngleOpacity = interpolate(frame, [200, 215], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Side Labels Reveal
  const labelAOpacity = interpolate(frame, [220, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelBOpacity = interpolate(frame, [260, 280], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelCOpacity = interpolate(frame, [300, 320], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 3: Squares Animation (420 -> 780)
  // Square A expansion (frame 430 -> 480)
  const squareAProgress = interpolate(frame, [430, 480], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Square B expansion (frame 510 -> 560)
  const squareBProgress = interpolate(frame, [510, 560], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Square C expansion (frame 590 -> 650)
  const squareCProgress = interpolate(frame, [590, 650], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Square area text reveal
  const areaAOpacity = interpolate(frame, [480, 500], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const areaBOpacity = interpolate(frame, [560, 580], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const areaCOpacity = interpolate(frame, [650, 670], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 4: Equation steps (780 -> 1140)
  const eqStep1Opacity = interpolate(frame, [790, 815], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eqStep2Opacity = interpolate(frame, [870, 895], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eqStep3Opacity = interpolate(frame, [950, 975], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eqStep4Opacity = interpolate(frame, [1030, 1055], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scene 5: Final Summary Screen (1140 -> 1350)
  const summaryOpacity = interpolate(frame, [1145, 1170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const summaryScale = interpolate(frame, [1145, 1180], [0.95, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Dynamically calculate square polygon points
  // Square A: Extrudes to the left by sideALength * squareAProgress
  const sqAxLeft = X0 - sideALength * squareAProgress;
  const polySquareA = `${X0},${Y0 - sideALength} ${sqAxLeft},${Y0 - sideALength} ${sqAxLeft},${Y0} ${X0},${Y0}`;

  // Square B: Extrudes downwards by sideBLength * squareBProgress
  const sqByBottom = Y0 + sideBLength * squareBProgress;
  const polySquareB = `${X0},${Y0} ${X0},${sqByBottom} ${X0 + sideBLength},${sqByBottom} ${X0 + sideBLength},${Y0}`;

  // Square C: Extrudes outward perpendicular to hypotenuse: vector (+180 * prog, -240 * prog)
  const vx = 180 * squareCProgress;
  const vy = -240 * squareCProgress;
  const polySquareC = `${X0},${Y0 - sideALength} ${X0 + sideBLength},${Y0} ${X0 + sideBLength + vx},${Y0 + vy} ${X0 + vx},${Y0 - sideALength + vy}`;

  // Grid line opacity for squares
  const gridLineOpacity = interpolate(frame, [670, 710], [0, 0.45], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLOR_BG,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: COLOR_TEXT_PRIMARY,
        overflow: "hidden",
      }}
    >
      {/* Background Decorative Blueprint Grid */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0.12,
          pointerEvents: "none",
        }}
      >
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38bdf8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* ========================================================================= */}
      {/* SCENE 1: TITLE CARD (0 -> 130 frames)                                     */}
      {/* ========================================================================= */}
      {frame < 140 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: "16px 36px",
              borderRadius: "50px",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              border: "2px solid #38bdf8",
              fontSize: "36px",
              fontWeight: 700,
              color: COLOR_SIDE_A,
              letterSpacing: "3px",
              marginBottom: "32px",
              textTransform: "uppercase",
            }}
          >
            Class 8 Mathematics
          </div>

          <h1
            style={{
              fontSize: "92px",
              fontWeight: 900,
              margin: 0,
              letterSpacing: "-1px",
              textAlign: "center",
              background: "linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            The Pythagorean Theorem
          </h1>

          <p
            style={{
              fontSize: "44px",
              color: COLOR_TEXT_MUTED,
              marginTop: "28px",
              fontWeight: 500,
            }}
          >
            Understanding right-angled triangles & side squares
          </p>
        </AbsoluteFill>
      )}

      {/* ========================================================================= */}
      {/* SCENES 2, 3, 4: MAIN WORKSPACE (130 -> 1150 frames)                       */}
      {/* ========================================================================= */}
      {frame >= 130 && frame < 1160 && (
        <AbsoluteFill style={{ opacity: mainWorkspaceOpacity }}>
          {/* Top Header Banner */}
          <div
            style={{
              position: "absolute",
              top: 40,
              left: 80,
              right: 80,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: `2px solid ${COLOR_BORDER}`,
              paddingBottom: "20px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  color: COLOR_SIDE_A,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                }}
              >
                Geometry Explainer
              </span>
              <h2
                style={{
                  fontSize: "52px",
                  fontWeight: 800,
                  margin: "6px 0 0 0",
                  color: COLOR_TEXT_PRIMARY,
                }}
              >
                {frame < 430
                  ? "Step 1: The 3 - 4 - 5 Right Triangle"
                  : frame < 780
                  ? "Step 2: Build a Square on Each Side"
                  : "Step 3: Discovering the Theorem"}
              </h2>
            </div>

            {/* Stage Indicator Pills */}
            <div style={{ display: "flex", gap: "16px" }}>
              <div
                style={{
                  padding: "10px 24px",
                  borderRadius: "24px",
                  fontSize: "26px",
                  fontWeight: 700,
                  backgroundColor: frame < 430 ? "#2563eb" : "rgba(255,255,255,0.06)",
                  color: frame < 430 ? "#ffffff" : COLOR_TEXT_MUTED,
                  border: `1px solid ${COLOR_BORDER}`,
                }}
              >
                1. Triangle
              </div>
              <div
                style={{
                  padding: "10px 24px",
                  borderRadius: "24px",
                  fontSize: "26px",
                  fontWeight: 700,
                  backgroundColor: frame >= 430 && frame < 780 ? "#2563eb" : "rgba(255,255,255,0.06)",
                  color: frame >= 430 && frame < 780 ? "#ffffff" : COLOR_TEXT_MUTED,
                  border: `1px solid ${COLOR_BORDER}`,
                }}
              >
                2. Side Squares
              </div>
              <div
                style={{
                  padding: "10px 24px",
                  borderRadius: "24px",
                  fontSize: "26px",
                  fontWeight: 700,
                  backgroundColor: frame >= 780 ? "#2563eb" : "rgba(255,255,255,0.06)",
                  color: frame >= 780 ? "#ffffff" : COLOR_TEXT_MUTED,
                  border: `1px solid ${COLOR_BORDER}`,
                }}
              >
                3. Formula
              </div>
            </div>
          </div>

          {/* LEFT AREA: GEOMETRIC DIAGRAM (SVG Canvas) */}
          <svg
            style={{
              position: "absolute",
              left: 20,
              top: 140,
              width: 1020,
              height: 900,
            }}
            viewBox="0 0 1020 900"
          >
            {/* 1. Square A (Side a = 3, Area = 9) */}
            {squareAProgress > 0 && (
              <polygon
                points={polySquareA}
                fill="rgba(56, 189, 248, 0.28)"
                stroke={COLOR_SIDE_A}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            )}

            {/* 2. Square B (Side b = 4, Area = 16) */}
            {squareBProgress > 0 && (
              <polygon
                points={polySquareB}
                fill="rgba(52, 211, 153, 0.28)"
                stroke={COLOR_SIDE_B}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            )}

            {/* 3. Square C (Hypotenuse c = 5, Area = 25) */}
            {squareCProgress > 0 && (
              <polygon
                points={polySquareC}
                fill="rgba(251, 191, 36, 0.28)"
                stroke={COLOR_SIDE_C}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            )}

            {/* Unit Grid Lines Inside Squares to visually prove box count */}
            {gridLineOpacity > 0 && (
              <g opacity={gridLineOpacity} stroke="#ffffff" strokeWidth="1.5">
                {/* Square A grid lines (3x3 = 9 cells, 60px each) */}
                <line x1={X0 - 60} y1={Y0 - sideALength} x2={X0 - 60} y2={Y0} />
                <line x1={X0 - 120} y1={Y0 - sideALength} x2={X0 - 120} y2={Y0} />
                <line x1={X0 - sideALength} y1={Y0 - 60} x2={X0} y2={Y0 - 60} />
                <line x1={X0 - sideALength} y1={Y0 - 120} x2={X0} y2={Y0 - 120} />

                {/* Square B grid lines (4x4 = 16 cells, 60px each) */}
                <line x1={X0 + 60} y1={Y0} x2={X0 + 60} y2={Y0 + sideBLength} />
                <line x1={X0 + 120} y1={Y0} x2={X0 + 120} y2={Y0 + sideBLength} />
                <line x1={X0 + 180} y1={Y0} x2={X0 + 180} y2={Y0 + sideBLength} />
                <line x1={X0} y1={Y0 + 60} x2={X0 + sideBLength} y2={Y0 + 60} />
                <line x1={X0} y1={Y0 + 120} x2={X0 + sideBLength} y2={Y0 + 120} />
                <line x1={X0} y1={Y0 + 180} x2={X0 + sideBLength} y2={Y0 + 180} />
              </g>
            )}

            {/* Main Right-Angled Triangle */}
            <polygon
              points={`${X0},${Y0 - sideALength} ${X0 + sideBLength},${Y0} ${X0},${Y0}`}
              fill="rgba(255, 255, 255, 0.08)"
              stroke="#ffffff"
              strokeWidth="5"
              strokeDasharray={trianglePerimeter}
              strokeDashoffset={triangleStrokeDashoffset}
              strokeLinejoin="round"
            />

            {/* Right Angle (90 degree) symbol at Vertex C */}
            <path
              d={`M ${X0} ${Y0 - 28} L ${X0 + 28} ${Y0 - 28} L ${X0 + 28} ${Y0}`}
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.5"
              opacity={rightAngleOpacity}
            />

            {/* Colored side stroke overlays */}
            {labelAOpacity > 0 && (
              <line
                x1={X0}
                y1={Y0 - sideALength}
                x2={X0}
                y2={Y0}
                stroke={COLOR_SIDE_A}
                strokeWidth="7"
                strokeLinecap="round"
                opacity={labelAOpacity}
              />
            )}
            {labelBOpacity > 0 && (
              <line
                x1={X0}
                y1={Y0}
                x2={X0 + sideBLength}
                y2={Y0}
                stroke={COLOR_SIDE_B}
                strokeWidth="7"
                strokeLinecap="round"
                opacity={labelBOpacity}
              />
            )}
            {labelCOpacity > 0 && (
              <line
                x1={X0}
                y1={Y0 - sideALength}
                x2={X0 + sideBLength}
                y2={Y0}
                stroke={COLOR_SIDE_C}
                strokeWidth="7"
                strokeLinecap="round"
                opacity={labelCOpacity}
              />
            )}

            {/* Side Length Labels on the Triangle */}
            {/* Side a label */}
            <g opacity={labelAOpacity}>
              <rect
                x={X0 - 130}
                y={Y0 - sideALength / 2 - 26}
                width="110"
                height="52"
                rx="12"
                fill="#0b1329"
                stroke={COLOR_SIDE_A}
                strokeWidth="2.5"
              />
              <text
                x={X0 - 75}
                y={Y0 - sideALength / 2 + 10}
                textAnchor="middle"
                fill={COLOR_SIDE_A}
                fontSize="32"
                fontWeight="800"
              >
                a = 3
              </text>
            </g>

            {/* Side b label */}
            <g opacity={labelBOpacity}>
              <rect
                x={X0 + sideBLength / 2 - 55}
                y={Y0 + 20}
                width="110"
                height="52"
                rx="12"
                fill="#0b1329"
                stroke={COLOR_SIDE_B}
                strokeWidth="2.5"
              />
              <text
                x={X0 + sideBLength / 2}
                y={Y0 + 56}
                textAnchor="middle"
                fill={COLOR_SIDE_B}
                fontSize="32"
                fontWeight="800"
              >
                b = 4
              </text>
            </g>

            {/* Side c (Hypotenuse) label */}
            <g opacity={labelCOpacity}>
              <rect
                x={X0 + sideBLength / 2 - 10}
                y={Y0 - sideALength / 2 - 68}
                width="200"
                height="52"
                rx="12"
                fill="#0b1329"
                stroke={COLOR_SIDE_C}
                strokeWidth="2.5"
              />
              <text
                x={X0 + sideBLength / 2 + 90}
                y={Y0 - sideALength / 2 - 32}
                textAnchor="middle"
                fill={COLOR_SIDE_C}
                fontSize="30"
                fontWeight="800"
              >
                c = 5 (Hyp.)
              </text>
            </g>

            {/* Center Area badges on Squares */}
            {/* Square A Area Badge */}
            <g opacity={areaAOpacity}>
              <circle cx={X0 - sideALength / 2} cy={Y0 - sideALength / 2} r="46" fill="#0b1329" stroke={COLOR_SIDE_A} strokeWidth="3.5" />
              <text
                x={X0 - sideALength / 2}
                y={Y0 - sideALength / 2 + 12}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="36"
                fontWeight="900"
              >
                9
              </text>
            </g>

            {/* Square B Area Badge */}
            <g opacity={areaBOpacity}>
              <circle cx={X0 + sideBLength / 2} cy={Y0 + sideBLength / 2} r="46" fill="#0b1329" stroke={COLOR_SIDE_B} strokeWidth="3.5" />
              <text
                x={X0 + sideBLength / 2}
                y={Y0 + sideBLength / 2 + 12}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="36"
                fontWeight="900"
              >
                16
              </text>
            </g>

            {/* Square C Area Badge */}
            <g opacity={areaCOpacity}>
              <circle cx={770} cy={390} r="50" fill="#0b1329" stroke={COLOR_SIDE_C} strokeWidth="4" />
              <text x={770} y={404} textAnchor="middle" fill="#ffffff" fontSize="42" fontWeight="900">
                25
              </text>
            </g>
          </svg>

          {/* RIGHT AREA: EDUCATIONAL EXPLANATION CARDS */}
          <div
            style={{
              position: "absolute",
              right: 80,
              top: 170,
              width: 780,
              bottom: 80,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            {/* Step 1 Cards: Sides Info */}
            {frame < 430 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: `2px solid ${COLOR_BORDER}`,
                    borderRadius: "20px",
                    padding: "32px",
                  }}
                >
                  <div style={{ fontSize: "36px", fontWeight: 700, color: "#ffffff", marginBottom: "16px" }}>
                    Right-Angled Triangle
                  </div>
                  <p style={{ fontSize: "30px", color: COLOR_TEXT_MUTED, margin: 0, lineHeight: 1.5 }}>
                    A triangle with one 90° angle. The two sides that form the right angle are the legs, and the longest side opposite to 90° is called the{" "}
                    <span style={{ color: COLOR_SIDE_C, fontWeight: 700 }}>Hypotenuse</span>.
                  </p>
                </div>

                {/* Side Measurements List */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: `2px solid ${COLOR_BORDER}`,
                    borderRadius: "20px",
                    padding: "30px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px", opacity: labelAOpacity }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "rgba(56, 189, 248, 0.2)",
                        border: `2px solid ${COLOR_SIDE_A}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "30px",
                        fontWeight: 800,
                        color: COLOR_SIDE_A,
                      }}
                    >
                      a
                    </div>
                    <span style={{ fontSize: "34px", fontWeight: 600 }}>Vertical Leg = 3 units</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "20px", opacity: labelBOpacity }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "rgba(52, 211, 153, 0.2)",
                        border: `2px solid ${COLOR_SIDE_B}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "30px",
                        fontWeight: 800,
                        color: COLOR_SIDE_B,
                      }}
                    >
                      b
                    </div>
                    <span style={{ fontSize: "34px", fontWeight: 600 }}>Horizontal Leg = 4 units</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "20px", opacity: labelCOpacity }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        backgroundColor: "rgba(251, 191, 36, 0.2)",
                        border: `2px solid ${COLOR_SIDE_C}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "30px",
                        fontWeight: 800,
                        color: COLOR_SIDE_C,
                      }}
                    >
                      c
                    </div>
                    <span style={{ fontSize: "34px", fontWeight: 700, color: COLOR_SIDE_C }}>
                      Hypotenuse = 5 units
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Cards: Square Areas (430 -> 780) */}
            {frame >= 430 && frame < 780 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "18px",
                }}
              >
                {/* Square A Details */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: `2px solid ${COLOR_SIDE_A}`,
                    borderRadius: "18px",
                    padding: "24px 30px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: areaAOpacity,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "28px", color: COLOR_SIDE_A, fontWeight: 700 }}>Square on Side a (3)</div>
                    <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "4px" }}>Area = 3 × 3 = 3²</div>
                  </div>
                  <div
                    style={{
                      fontSize: "48px",
                      fontWeight: 900,
                      color: COLOR_SIDE_A,
                      backgroundColor: "rgba(56, 189, 248, 0.15)",
                      padding: "8px 24px",
                      borderRadius: "14px",
                    }}
                  >
                    9
                  </div>
                </div>

                {/* Square B Details */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: `2px solid ${COLOR_SIDE_B}`,
                    borderRadius: "18px",
                    padding: "24px 30px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: areaBOpacity,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "28px", color: COLOR_SIDE_B, fontWeight: 700 }}>Square on Side b (4)</div>
                    <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "4px" }}>Area = 4 × 4 = 4²</div>
                  </div>
                  <div
                    style={{
                      fontSize: "48px",
                      fontWeight: 900,
                      color: COLOR_SIDE_B,
                      backgroundColor: "rgba(52, 211, 153, 0.15)",
                      padding: "8px 24px",
                      borderRadius: "14px",
                    }}
                  >
                    16
                  </div>
                </div>

                {/* Square C Details */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: `2px solid ${COLOR_SIDE_C}`,
                    borderRadius: "18px",
                    padding: "24px 30px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: areaCOpacity,
                  }}
                >
                  <div>
                    <div style={{ fontSize: "28px", color: COLOR_SIDE_C, fontWeight: 700 }}>Square on Hypotenuse c (5)</div>
                    <div style={{ fontSize: "36px", fontWeight: 800, marginTop: "4px" }}>Area = 5 × 5 = 5²</div>
                  </div>
                  <div
                    style={{
                      fontSize: "48px",
                      fontWeight: 900,
                      color: COLOR_SIDE_C,
                      backgroundColor: "rgba(251, 191, 36, 0.15)",
                      padding: "8px 24px",
                      borderRadius: "14px",
                    }}
                  >
                    25
                  </div>
                </div>

                {/* Question teaser banner */}
                {frame >= 680 && (
                  <div
                    style={{
                      padding: "22px 28px",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "2px dashed rgba(255, 255, 255, 0.3)",
                      borderRadius: "18px",
                      textAlign: "center",
                      fontSize: "30px",
                      fontWeight: 600,
                      color: "#ffffff",
                    }}
                  >
                    Look at the areas: What is <span style={{ color: COLOR_SIDE_A, fontWeight: 800 }}>9</span> +{" "}
                    <span style={{ color: COLOR_SIDE_B, fontWeight: 800 }}>16</span>?
                  </div>
                )}
              </div>
            )}

            {/* Step 3 Cards: Derivation & Formula (780 -> 1140) */}
            {frame >= 780 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                {/* Equation Step 1: The General Formula */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: "2px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "20px",
                    padding: "26px 32px",
                    opacity: eqStep1Opacity,
                  }}
                >
                  <div style={{ fontSize: "26px", color: COLOR_TEXT_MUTED, fontWeight: 700, marginBottom: "8px" }}>
                    THE THEOREM FORMULA
                  </div>
                  <div
                    style={{
                      fontSize: "58px",
                      fontWeight: 900,
                      letterSpacing: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <span style={{ color: COLOR_SIDE_A }}>a²</span>
                    <span style={{ color: "#ffffff" }}>+</span>
                    <span style={{ color: COLOR_SIDE_B }}>b²</span>
                    <span style={{ color: "#ffffff" }}>=</span>
                    <span style={{ color: COLOR_SIDE_C }}>c²</span>
                  </div>
                </div>

                {/* Equation Step 2: Plug in side lengths */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: "2px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "20px",
                    padding: "24px 32px",
                    opacity: eqStep2Opacity,
                  }}
                >
                  <div style={{ fontSize: "24px", color: COLOR_TEXT_MUTED, fontWeight: 700, marginBottom: "6px" }}>
                    SUBSTITUTE SIDES (3, 4, 5)
                  </div>
                  <div
                    style={{
                      fontSize: "50px",
                      fontWeight: 800,
                      letterSpacing: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <span style={{ color: COLOR_SIDE_A }}>3²</span>
                    <span style={{ color: "#ffffff" }}>+</span>
                    <span style={{ color: COLOR_SIDE_B }}>4²</span>
                    <span style={{ color: "#ffffff" }}>=</span>
                    <span style={{ color: COLOR_SIDE_C }}>5²</span>
                  </div>
                </div>

                {/* Equation Step 3: Plug in areas */}
                <div
                  style={{
                    backgroundColor: COLOR_PANEL,
                    border: "2px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "20px",
                    padding: "24px 32px",
                    opacity: eqStep3Opacity,
                  }}
                >
                  <div style={{ fontSize: "24px", color: COLOR_TEXT_MUTED, fontWeight: 700, marginBottom: "6px" }}>
                    CALCULATE SQUARES
                  </div>
                  <div
                    style={{
                      fontSize: "50px",
                      fontWeight: 800,
                      letterSpacing: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <span style={{ color: COLOR_SIDE_A }}>9</span>
                    <span style={{ color: "#ffffff" }}>+</span>
                    <span style={{ color: COLOR_SIDE_B }}>16</span>
                    <span style={{ color: "#ffffff" }}>=</span>
                    <span style={{ color: COLOR_SIDE_C }}>25</span>
                  </div>
                </div>

                {/* Equation Step 4: Verification badge */}
                <div
                  style={{
                    backgroundColor: "rgba(16, 185, 129, 0.15)",
                    border: "3px solid #10b981",
                    borderRadius: "20px",
                    padding: "22px 32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: eqStep4Opacity,
                  }}
                >
                  <div style={{ fontSize: "52px", fontWeight: 900, color: "#10b981" }}>25 = 25</div>
                  <div
                    style={{
                      backgroundColor: "#10b981",
                      color: "#ffffff",
                      fontSize: "28px",
                      fontWeight: 800,
                      padding: "10px 24px",
                      borderRadius: "30px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span>✓</span> Verified!
                  </div>
                </div>
              </div>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ========================================================================= */}
      {/* SCENE 5: SUMMARY & TAKEAWAY CARD (1140 -> 1350 frames)                    */}
      {/* ========================================================================= */}
      {frame >= 1140 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: "80px",
            opacity: summaryOpacity,
            transform: `scale(${summaryScale})`,
            zIndex: 40,
          }}
        >
          <div
            style={{
              width: "1480px",
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              border: "3px solid rgba(56, 189, 248, 0.5)",
              borderRadius: "36px",
              padding: "70px 80px",
              boxShadow: "0 25px 80px rgba(0, 0, 0, 0.6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {/* Pill Badge */}
            <div
              style={{
                backgroundColor: "rgba(56, 189, 248, 0.18)",
                border: "2px solid #38bdf8",
                padding: "12px 36px",
                borderRadius: "40px",
                fontSize: "30px",
                fontWeight: 800,
                color: COLOR_SIDE_A,
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: "28px",
              }}
            >
              Summary Rule
            </div>

            <h2
              style={{
                fontSize: "80px",
                fontWeight: 900,
                margin: "0 0 32px 0",
                color: "#ffffff",
                letterSpacing: "-1px",
              }}
            >
              The Pythagorean Theorem
            </h2>

            {/* Main Theorem Definition Statement */}
            <div
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderLeft: `8px solid ${COLOR_SIDE_C}`,
                borderRadius: "16px",
                padding: "36px 48px",
                fontSize: "46px",
                lineHeight: 1.45,
                fontWeight: 600,
                color: "#f8fafc",
                marginBottom: "44px",
                textAlign: "left",
              }}
            >
              "In a right triangle, the square of the hypotenuse equals the sum of the squares of the other two sides."
            </div>

            {/* Formula Callout Banner */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "50px",
              }}
            >
              <div
                style={{
                  fontSize: "64px",
                  fontWeight: 900,
                  letterSpacing: "4px",
                  color: "#ffffff",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  padding: "16px 48px",
                  borderRadius: "20px",
                  border: `2px solid ${COLOR_BORDER}`,
                }}
              >
                <span style={{ color: COLOR_SIDE_A }}>a²</span> + <span style={{ color: COLOR_SIDE_B }}>b²</span> ={" "}
                <span style={{ color: COLOR_SIDE_C }}>c²</span>
              </div>

              <div
                style={{
                  fontSize: "52px",
                  fontWeight: 800,
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <span>( 9 + 16 = 25 )</span>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};