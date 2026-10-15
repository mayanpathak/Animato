import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from "remotion";

export const DURATION_SECONDS = 45;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Color palette
  const bg = "#080e1e";
  const colorA = "#38bdf8"; // cyan / side a
  const colorB = "#fb923c"; // orange / side b
  const colorC = "#4ade80"; // green / hypotenuse c
  const textWhite = "#f8fafc";
  const textMuted = "#94a3b8";
  const accentGold = "#facc15";

  // --- PHASE TIMINGS (in frames @ 20fps, total 900) ---
  // 0 - 100 (0 - 5.0s): Title card
  // 100 - 280 (5.0s - 14.0s): Draw right triangle & label sides 3, 4, 5
  // 280 - 520 (14.0s - 26.0s): Draw squares on sides with areas 9, 16, 25
  // 520 - 710 (26.0s - 35.5s): Show equation step-by-step 9 + 16 = 25 -> a² + b² = c²
  // 710 - 900 (35.5s - 45.0s): Summary statement and key takeaway

  // Title Card animation
  const titleOpacity = interpolate(frame, [0, 20, 80, 100], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 25], [40, 0], {
    extrapolateRight: "clamp",
  });

  // Main scene fade-in from frame 95
  const sceneOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Triangle draw progress
  const triDraw = interpolate(frame, [110, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Side labels entrance
  const labelASpring = spring({
    frame: frame - 160,
    fps,
    config: { damping: 12 },
  });
  const labelBSpring = spring({
    frame: frame - 180,
    fps,
    config: { damping: 12 },
  });
  const labelCSpring = spring({
    frame: frame - 200,
    fps,
    config: { damping: 12 },
  });

  // Squares entrance
  const sqASpring = spring({
    frame: frame - 290,
    fps,
    config: { damping: 14 },
  });
  const sqBSpring = spring({
    frame: frame - 330,
    fps,
    config: { damping: 14 },
  });
  const sqCSpring = spring({
    frame: frame - 380,
    fps,
    config: { damping: 14 },
  });

  // Equations step-by-step
  const eqStep1 = spring({
    frame: frame - 520,
    fps,
    config: { damping: 14 },
  });
  const eqStep2 = spring({
    frame: frame - 575,
    fps,
    config: { damping: 14 },
  });
  const eqStep3 = spring({
    frame: frame - 635,
    fps,
    config: { damping: 14 },
  });

  // Summary entrance
  const summaryOpacity = interpolate(frame, [715, 745], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const summaryY = interpolate(frame, [715, 745], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Geometric coordinates for 3-4-5 Triangle:
  // Base C at (480, 620)
  // Leg a = vertical = 150px (3 units) -> A = (480, 470)
  // Leg b = horizontal = 200px (4 units) -> B = (680, 620)
  // Hypotenuse c = 250px (5 units)
  // Square a (left): (330, 470) to (480, 620) -> 150x150
  // Square b (bottom): (480, 620) to (680, 820) -> 200x200
  // Square c (hypotenuse tilted): (480,470), (630,270), (830,420), (680,620)

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: textWhite,
        overflow: "hidden",
      }}
    >
      {/* Background subtle grid pattern for mathematical feel */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: 1920,
          height: 1080,
          opacity: 0.07,
        }}
      >
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#grid)" />
      </svg>

      {/* -------------------- PHASE 1: TITLE CARD -------------------- */}
      {frame < 110 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 44,
              color: accentGold,
              letterSpacing: 6,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Class 8 Mathematics
          </div>
          <div
            style={{
              fontSize: 104,
              fontWeight: 900,
              color: textWhite,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            The Pythagorean Theorem
          </div>
          <div
            style={{
              fontSize: 52,
              color: textMuted,
              marginTop: 35,
              fontWeight: 500,
            }}
          >
            A visual proof using squares and areas
          </div>
        </AbsoluteFill>
      )}

      {/* -------------------- MAIN LESSON SCENE -------------------- */}
      {frame >= 95 && (
        <AbsoluteFill style={{ opacity: sceneOpacity }}>
          {/* Header banner */}
          <div
            style={{
              position: "absolute",
              top: 50,
              left: 100,
              right: 100,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "3px solid #1e293b",
              paddingBottom: 25,
            }}
          >
            <div style={{ fontSize: 60, fontWeight: 800, color: textWhite }}>
              The Pythagorean Theorem
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 600,
                color: accentGold,
                background: "#1e293b",
                padding: "10px 24px",
                borderRadius: 12,
              }}
            >
              Right-Angled Triangles
            </div>
          </div>

          {/* LEFT COLUMN: DIAGRAM (SVG 3-4-5 Triangle & Squares) */}
          <div
            style={{
              position: "absolute",
              left: 60,
              top: 150,
              width: 880,
              height: 870,
            }}
          >
            <svg
              width="880"
              height="870"
              viewBox="200 160 740 740"
              style={{ overflow: "visible" }}
            >
              {/* --- SQUARE A (Side 3, Area 9) --- */}
              {frame >= 280 && (
                <g
                  style={{
                    transformOrigin: "480px 470px",
                    transform: `scale(${Math.max(0, sqASpring)})`,
                    opacity: Math.min(1, sqASpring),
                  }}
                >
                  <rect
                    x="330"
                    y="470"
                    width="150"
                    height="150"
                    fill={colorA}
                    fillOpacity="0.3"
                    stroke={colorA}
                    strokeWidth="6"
                  />
                  {/* Grid lines inside square a (3x3) */}
                  <line
                    x1="380"
                    y1="470"
                    x2="380"
                    y2="620"
                    stroke={colorA}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="430"
                    y1="470"
                    x2="430"
                    y2="620"
                    stroke={colorA}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="330"
                    y1="520"
                    x2="480"
                    y2="520"
                    stroke={colorA}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="330"
                    y1="570"
                    x2="480"
                    y2="570"
                    stroke={colorA}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <text
                    x="405"
                    y="555"
                    textAnchor="middle"
                    fill={colorA}
                    fontSize="48"
                    fontWeight="800"
                  >
                    9
                  </text>
                </g>
              )}

              {/* --- SQUARE B (Side 4, Area 16) --- */}
              {frame >= 320 && (
                <g
                  style={{
                    transformOrigin: "480px 620px",
                    transform: `scale(${Math.max(0, sqBSpring)})`,
                    opacity: Math.min(1, sqBSpring),
                  }}
                >
                  <rect
                    x="480"
                    y="620"
                    width="200"
                    height="200"
                    fill={colorB}
                    fillOpacity="0.3"
                    stroke={colorB}
                    strokeWidth="6"
                  />
                  {/* Grid lines inside square b (4x4) */}
                  <line
                    x1="530"
                    y1="620"
                    x2="530"
                    y2="820"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="580"
                    y1="620"
                    x2="580"
                    y2="820"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="630"
                    y1="620"
                    x2="630"
                    y2="820"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="480"
                    y1="670"
                    x2="680"
                    y2="670"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="480"
                    y1="720"
                    x2="680"
                    y2="720"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <line
                    x1="480"
                    y1="770"
                    x2="680"
                    y2="770"
                    stroke={colorB}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                  <text
                    x="580"
                    y="730"
                    textAnchor="middle"
                    fill={colorB}
                    fontSize="52"
                    fontWeight="800"
                  >
                    16
                  </text>
                </g>
              )}

              {/* --- SQUARE C (Side 5, Area 25) --- */}
              {frame >= 370 && (
                <g
                  style={{
                    transformOrigin: "580px 545px",
                    transform: `scale(${Math.max(0, sqCSpring)})`,
                    opacity: Math.min(1, sqCSpring),
                  }}
                >
                  <polygon
                    points="480,470 630,270 830,420 680,620"
                    fill={colorC}
                    fillOpacity="0.3"
                    stroke={colorC}
                    strokeWidth="6"
                  />
                  <text
                    x="655"
                    y="460"
                    textAnchor="middle"
                    fill={colorC}
                    fontSize="60"
                    fontWeight="900"
                  >
                    25
                  </text>
                </g>
              )}

              {/* --- MAIN RIGHT-ANGLED TRIANGLE --- */}
              <polygon
                points="480,470 480,620 680,620"
                fill="#1e293b"
                stroke="#ffffff"
                strokeWidth="7"
                strokeDasharray="600"
                strokeDashoffset={600 * (1 - triDraw)}
              />

              {/* Right-angle symbol (corner at 480, 620) */}
              {triDraw >= 0.9 && (
                <path
                  d="M 480 590 L 510 590 L 510 620"
                  fill="none"
                  stroke={accentGold}
                  strokeWidth="5"
                />
              )}

              {/* Side Label A: length = 3 */}
              {frame >= 160 && (
                <g
                  style={{
                    transform: `scale(${Math.max(0, labelASpring)})`,
                    transformOrigin: "440px 545px",
                  }}
                >
                  <text
                    x="430"
                    y="555"
                    textAnchor="end"
                    fill={colorA}
                    fontSize="54"
                    fontWeight="800"
                  >
                    a = 3
                  </text>
                </g>
              )}

              {/* Side Label B: length = 4 */}
              {frame >= 180 && (
                <g
                  style={{
                    transform: `scale(${Math.max(0, labelBSpring)})`,
                    transformOrigin: "580px 670px",
                  }}
                >
                  <text
                    x="580"
                    y="670"
                    textAnchor="middle"
                    fill={colorB}
                    fontSize="54"
                    fontWeight="800"
                  >
                    b = 4
                  </text>
                </g>
              )}

              {/* Side Label C: length = 5 */}
              {frame >= 200 && (
                <g
                  style={{
                    transform: `scale(${Math.max(0, labelCSpring)})`,
                    transformOrigin: "600px 525px",
                  }}
                >
                  <text
                    x="605"
                    y="525"
                    fill={colorC}
                    fontSize="54"
                    fontWeight="800"
                  >
                    c = 5
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* RIGHT COLUMN: STEP-BY-STEP EXPLANATION */}
          <div
            style={{
              position: "absolute",
              left: 980,
              top: 175,
              width: 840,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            {/* STEP 1: Side lengths */}
            <div
              style={{
                backgroundColor: "#111c35",
                borderRadius: 18,
                padding: "24px 34px",
                borderLeft: `10px solid ${colorA}`,
                opacity: interpolate(frame, [115, 140], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                Step 1 · Identify the Sides
              </div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  color: textWhite,
                  marginTop: 8,
                }}
              >
                Legs: <span style={{ color: colorA }}>a = 3</span>,{" "}
                <span style={{ color: colorB }}>b = 4</span> | Hypotenuse:{" "}
                <span style={{ color: colorC }}>c = 5</span>
              </div>
            </div>

            {/* STEP 2: Squares built on sides */}
            {frame >= 280 && (
              <div
                style={{
                  backgroundColor: "#111c35",
                  borderRadius: 18,
                  padding: "24px 34px",
                  borderLeft: `10px solid ${colorB}`,
                  opacity: Math.min(1, sqASpring),
                  transform: `translateY(${(1 - Math.min(1, sqASpring)) * 20}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: textMuted,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Step 2 · Build a Square on Each Side
                </div>
                <div
                  style={{
                    fontSize: 52,
                    fontWeight: 700,
                    color: textWhite,
                    marginTop: 10,
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    Area on side a = 3² ={" "}
                    <span style={{ color: colorA, fontWeight: 800 }}>9</span>
                  </div>
                  <div>
                    Area on side b = 4² ={" "}
                    <span style={{ color: colorB, fontWeight: 800 }}>16</span>
                  </div>
                  <div>
                    Area on side c = 5² ={" "}
                    <span style={{ color: colorC, fontWeight: 800 }}>25</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Plug into equation */}
            {frame >= 520 && (
              <div
                style={{
                  backgroundColor: "#162544",
                  borderRadius: 18,
                  padding: "28px 34px",
                  borderLeft: `10px solid ${accentGold}`,
                  opacity: Math.min(1, eqStep1),
                  transform: `translateY(${(1 - Math.min(1, eqStep1)) * 20}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 34,
                    fontWeight: 700,
                    color: accentGold,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Step 3 · Compare the Areas
                </div>

                {/* 9 + 16 = 25 */}
                <div
                  style={{
                    fontSize: 66,
                    fontWeight: 900,
                    marginTop: 14,
                    color: textWhite,
                    letterSpacing: 1,
                  }}
                >
                  <span style={{ color: colorA }}>9</span> +{" "}
                  <span style={{ color: colorB }}>16</span> ={" "}
                  <span style={{ color: colorC }}>25</span>
                </div>

                {/* a² + b² = c² */}
                {frame >= 620 && (
                  <div
                    style={{
                      fontSize: 72,
                      fontWeight: 900,
                      marginTop: 12,
                      color: accentGold,
                      opacity: Math.min(1, eqStep3),
                      transform: `scale(${Math.max(0.8, eqStep3)})`,
                      transformOrigin: "left center",
                    }}
                  >
                    <span style={{ color: colorA }}>a²</span> +{" "}
                    <span style={{ color: colorB }}>b²</span> ={" "}
                    <span style={{ color: colorC }}>c²</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FINAL SUMMARY BANNER (Frames 715 - 900) */}
          {frame >= 710 && (
            <div
              style={{
                position: "absolute",
                bottom: 35,
                left: 100,
                right: 100,
                backgroundColor: "#0d2847",
                border: "4px solid #38bdf8",
                borderRadius: 22,
                padding: "24px 44px",
                opacity: summaryOpacity,
                transform: `translateY(${summaryY}px)`,
                boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: textWhite,
                  textAlign: "center",
                  lineHeight: 1.35,
                }}
              >
                “In a right triangle, the square of the hypotenuse equals the sum
                of the squares of the other two sides.”
              </div>
            </div>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};