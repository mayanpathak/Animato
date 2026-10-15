import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from "remotion";

export const DURATION_SECONDS = 30;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------
  // PHASE TIMINGS (Total = 600 frames at 20 fps = 30 seconds)
  // Phase 1 (0   - 110f): Whole Pizza (1 Whole)
  // Phase 2 (110 - 230f): Cut into 4 Equal Slices
  // Phase 3 (230 - 360f): Shade 1 slice -> 1/4
  // Phase 4 (360 - 480f): Shade 3 slices -> 3/4
  // Phase 5 (480 - 600f): Text Summary ("A fraction shows a part of a whole")
  // -------------------------------------------------------------

  // Title header text & color based on frame
  let titleText = "The Whole Pizza";
  let subtitleText = "One complete pizza before cutting";
  if (frame >= 480) {
    titleText = "Math Rule to Remember";
    subtitleText = "Fractions represent parts of any equal whole";
  } else if (frame >= 360) {
    titleText = "Three Slices Out of Four = 3/4";
    subtitleText = "Now we take 3 equal pieces";
  } else if (frame >= 230) {
    titleText = "One Slice Out of Four = 1/4";
    subtitleText = "We take 1 piece from 4 equal pieces";
  } else if (frame >= 110) {
    titleText = "Cut into 4 Equal Slices";
    subtitleText = "Every slice must be the exact same size!";
  }

  // Animation values
  const pizzaEntrance = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 100 },
  });

  // Cutting line reveal (frames 110 to 140)
  const cutProgress = interpolate(frame, [110, 138], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slices separation distance (frames 135 to 160)
  const baseSep = interpolate(frame, [135, 160], [0, 16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulling out Slice 1 in Phase 3
  const slice1Extra = interpolate(frame, [230, 255], [0, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Opacity for unshaded slices in Phase 3 & 4
  const unshadedOpacity3 = interpolate(frame, [230, 245], [1, 0.28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slice23Opacity4 = interpolate(frame, [360, 375], [0.28, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slice individual opacities:
  // Slice 1: active in Phase 3 & Phase 4
  const slice1Opacity = 1;
  // Slice 2 & 3: dimmed in Phase 3, active in Phase 4
  const slice2Opacity = frame < 230 ? 1 : frame < 360 ? unshadedOpacity3 : slice23Opacity4;
  const slice3Opacity = frame < 230 ? 1 : frame < 360 ? unshadedOpacity3 : slice23Opacity4;
  // Slice 4: stays dimmed in Phase 3 and Phase 4
  const slice4Opacity = frame < 230 ? 1 : unshadedOpacity3;

  // Final summary overlay spring (frame 480+)
  const summarySpring = spring({
    frame: frame - 480,
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  // Colors
  const crustColor = "#d97706";
  const cheeseColor = "#fbbf24";
  const cheeseHighlight = "#fef08a";
  const sauceColor = "#ea580c";
  const pepColor = "#dc2626";
  const darkPep = "#991b1b";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f8fafc",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
          }}
        >
          {titleText}
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 600,
            color: "#475569",
            marginTop: 10,
          }}
        >
          {subtitleText}
        </div>
      </div>

      {/* Main Content Area (Pizza Left, Explanations Right) */}
      <div
        style={{
          position: "absolute",
          top: 220,
          left: 100,
          right: 100,
          bottom: 60,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left Side: Pizza Container */}
        <div
          style={{
            width: 720,
            height: 720,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            transform: `scale(${pizzaEntrance})`,
          }}
        >
          <svg
            width="680"
            height="680"
            viewBox="0 0 520 520"
            style={{ overflow: "visible" }}
          >
            {/* Base plate shadow */}
            <circle cx="260" cy="266" r="236" fill="#cbd5e1" opacity="0.6" />
            <circle cx="260" cy="260" r="232" fill="#ffffff" stroke="#e2e8f0" strokeWidth="8" />

            {/* SLICE 1: Top-Right */}
            <g
              transform={`translate(${baseSep + (frame >= 230 && frame < 360 ? slice1Extra : 0)}, -${baseSep + (frame >= 230 && frame < 360 ? slice1Extra : 0)})`}
              opacity={slice1Opacity}
            >
              <path
                d="M 260 260 L 260 50 A 210 210 0 0 1 470 260 Z"
                fill={frame >= 230 ? cheeseHighlight : cheeseColor}
                stroke={sauceColor}
                strokeWidth="5"
              />
              <path
                d="M 260 50 A 210 210 0 0 1 470 260"
                fill="none"
                stroke={crustColor}
                strokeWidth="24"
                strokeLinecap="round"
              />
              {/* Pepperonis */}
              <circle cx="345" cy="165" r="24" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="410" cy="225" r="20" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="305" cy="220" r="18" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              {/* Label inside slice if highlighted */}
              {frame >= 230 && (
                <text
                  x="335"
                  y="125"
                  fill="#1e293b"
                  fontSize="48"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  1
                </text>
              )}
            </g>

            {/* SLICE 2: Bottom-Right */}
            <g
              transform={`translate(${baseSep}, ${baseSep})`}
              opacity={slice2Opacity}
            >
              <path
                d="M 260 260 L 470 260 A 210 210 0 0 1 260 470 Z"
                fill={frame >= 360 ? cheeseHighlight : cheeseColor}
                stroke={sauceColor}
                strokeWidth="5"
              />
              <path
                d="M 470 260 A 210 210 0 0 1 260 470"
                fill="none"
                stroke={crustColor}
                strokeWidth="24"
                strokeLinecap="round"
              />
              <circle cx="345" cy="355" r="24" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="410" cy="295" r="20" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="305" cy="300" r="18" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              {frame >= 360 && (
                <text
                  x="350"
                  y="400"
                  fill="#1e293b"
                  fontSize="48"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  2
                </text>
              )}
            </g>

            {/* SLICE 3: Bottom-Left */}
            <g
              transform={`translate(-${baseSep}, ${baseSep})`}
              opacity={slice3Opacity}
            >
              <path
                d="M 260 260 L 260 470 A 210 210 0 0 1 50 260 Z"
                fill={frame >= 360 ? cheeseHighlight : cheeseColor}
                stroke={sauceColor}
                strokeWidth="5"
              />
              <path
                d="M 260 470 A 210 210 0 0 1 50 260"
                fill="none"
                stroke={crustColor}
                strokeWidth="24"
                strokeLinecap="round"
              />
              <circle cx="175" cy="355" r="24" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="110" cy="295" r="20" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="215" cy="300" r="18" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              {frame >= 360 && (
                <text
                  x="170"
                  y="400"
                  fill="#1e293b"
                  fontSize="48"
                  fontWeight="900"
                  textAnchor="middle"
                >
                  3
                </text>
              )}
            </g>

            {/* SLICE 4: Top-Left */}
            <g
              transform={`translate(-${baseSep}, -${baseSep})`}
              opacity={slice4Opacity}
            >
              <path
                d="M 260 260 L 50 260 A 210 210 0 0 1 260 50 Z"
                fill={cheeseColor}
                stroke={sauceColor}
                strokeWidth="5"
              />
              <path
                d="M 50 260 A 210 210 0 0 1 260 50"
                fill="none"
                stroke={crustColor}
                strokeWidth="24"
                strokeLinecap="round"
              />
              <circle cx="175" cy="165" r="24" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="110" cy="225" r="20" fill={pepColor} stroke={darkPep} strokeWidth="3" />
              <circle cx="215" cy="220" r="18" fill={pepColor} stroke={darkPep} strokeWidth="3" />
            </g>

            {/* Animated Cutting Lines (Phase 2) */}
            {frame >= 110 && frame < 240 && (
              <>
                <line
                  x1="260"
                  y1={260 - 220 * cutProgress}
                  x2="260"
                  y2={260 + 220 * cutProgress}
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeDasharray="14 10"
                  strokeLinecap="round"
                />
                <line
                  x1={260 - 220 * cutProgress}
                  y1="260"
                  x2={260 + 220 * cutProgress}
                  y2="260"
                  stroke="#2563eb"
                  strokeWidth="8"
                  strokeDasharray="14 10"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </div>

        {/* Right Side: Educational Card Display */}
        <div
          style={{
            width: 860,
            backgroundColor: "#ffffff",
            borderRadius: 36,
            boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.12)",
            border: "4px solid #e2e8f0",
            padding: "50px 60px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 560,
          }}
        >
          {/* Phase 1: 1 Whole */}
          {frame < 110 && (
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  borderRadius: 20,
                  backgroundColor: "#fef3c7",
                  color: "#b45309",
                  fontSize: 44,
                  fontWeight: 800,
                  marginBottom: 24,
                }}
              >
                1 WHOLE
              </div>
              <div
                style={{
                  fontSize: 84,
                  fontWeight: 900,
                  color: "#0f172a",
                  lineHeight: 1.1,
                  marginBottom: 24,
                }}
              >
                1 Full Unit
              </div>
              <div
                style={{
                  fontSize: 48,
                  color: "#475569",
                  lineHeight: 1.4,
                }}
              >
                We have <strong>1 entire pizza</strong> that has not been divided yet.
              </div>
            </div>
          )}

          {/* Phase 2: Cut into 4 Equal Slices */}
          {frame >= 110 && frame < 230 && (
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  borderRadius: 20,
                  backgroundColor: "#dbeafe",
                  color: "#1d4ed8",
                  fontSize: 44,
                  fontWeight: 800,
                  marginBottom: 24,
                }}
              >
                EQUAL PARTS
              </div>
              <div
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: "#0f172a",
                  lineHeight: 1.15,
                  marginBottom: 24,
                }}
              >
                4 Equal Slices
              </div>
              <div
                style={{
                  fontSize: 46,
                  color: "#334155",
                  lineHeight: 1.45,
                }}
              >
                The whole is divided into <strong style={{ color: "#2563eb" }}>4 equal</strong> parts.
                <br />
                <span style={{ fontSize: 44, color: "#64748b", marginTop: 12, display: "block" }}>
                  Every fraction starts with equal pieces!
                </span>
              </div>
            </div>
          )}

          {/* Phase 3: 1 / 4 Fraction Card */}
          {frame >= 230 && frame < 360 && (
            <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
              {/* Giant Fraction Display */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 160,
                }}
              >
                <div
                  style={{
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#2563eb",
                    lineHeight: 1,
                  }}
                >
                  1
                </div>
                <div
                  style={{
                    width: 140,
                    height: 10,
                    backgroundColor: "#0f172a",
                    borderRadius: 5,
                    margin: "12px 0",
                  }}
                />
                <div
                  style={{
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#0f172a",
                    lineHeight: 1,
                  }}
                >
                  4
                </div>
              </div>

              {/* Fraction explanation breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: "#2563eb" }}>
                    Numerator (1)
                  </div>
                  <div style={{ fontSize: 44, color: "#475569" }}>
                    1 slice is chosen
                  </div>
                </div>
                <div
                  style={{
                    height: 3,
                    backgroundColor: "#e2e8f0",
                    width: "100%",
                  }}
                />
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: "#0f172a" }}>
                    Denominator (4)
                  </div>
                  <div style={{ fontSize: 44, color: "#475569" }}>
                    4 equal slices in total
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Phase 4: 3 / 4 Fraction Card */}
          {frame >= 360 && frame < 480 && (
            <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
              {/* Giant Fraction Display */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 160,
                }}
              >
                <div
                  style={{
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#d97706",
                    lineHeight: 1,
                  }}
                >
                  3
                </div>
                <div
                  style={{
                    width: 140,
                    height: 10,
                    backgroundColor: "#0f172a",
                    borderRadius: 5,
                    margin: "12px 0",
                  }}
                />
                <div
                  style={{
                    fontSize: 120,
                    fontWeight: 900,
                    color: "#0f172a",
                    lineHeight: 1,
                  }}
                >
                  4
                </div>
              </div>

              {/* Fraction explanation breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: "#d97706" }}>
                    Numerator (3)
                  </div>
                  <div style={{ fontSize: 44, color: "#475569" }}>
                    3 slices are chosen
                  </div>
                </div>
                <div
                  style={{
                    height: 3,
                    backgroundColor: "#e2e8f0",
                    width: "100%",
                  }}
                />
                <div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: "#0f172a" }}>
                    Denominator (4)
                  </div>
                  <div style={{ fontSize: 44, color: "#475569" }}>
                    4 equal slices in total
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fallback space for phase 5 placeholder */}
          {frame >= 480 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#059669" }}>
                Well Done!
              </div>
              <div style={{ fontSize: 44, color: "#475569", marginTop: 16 }}>
                You just learned how fractions work!
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PHASE 5: Grand Summary Card Overlay (Frames 480 to 600) */}
      {frame >= 480 && (
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
          }}
        >
          <div
            style={{
              width: 1600,
              backgroundColor: "#ffffff",
              borderRadius: 44,
              padding: "70px 90px",
              boxShadow: "0 30px 60px rgba(0, 0, 0, 0.35)",
              transform: `scale(${summarySpring})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                padding: "12px 32px",
                borderRadius: 50,
                backgroundColor: "#ecfdf5",
                color: "#059669",
                fontSize: 44,
                fontWeight: 900,
                marginBottom: 30,
              }}
            >
              LESSON SUMMARY
            </div>

            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                color: "#0f172a",
                lineHeight: 1.25,
                maxWidth: 1400,
              }}
            >
              &ldquo;A fraction shows a part of a whole.&rdquo;
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                gap: 60,
                marginTop: 50,
                width: "100%",
              }}
            >
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f1f5f9",
                  padding: "30px 40px",
                  borderRadius: 28,
                  border: "3px solid #cbd5e1",
                }}
              >
                <div style={{ fontSize: 46, fontWeight: 900, color: "#2563eb" }}>
                  Numerator (Top)
                </div>
                <div style={{ fontSize: 44, color: "#334155", marginTop: 10 }}>
                  Number of parts we have
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f1f5f9",
                  padding: "30px 40px",
                  borderRadius: 28,
                  border: "3px solid #cbd5e1",
                }}
              >
                <div style={{ fontSize: 46, fontWeight: 900, color: "#0f172a" }}>
                  Denominator (Bottom)
                </div>
                <div style={{ fontSize: 44, color: "#334155", marginTop: 10 }}>
                  Total equal parts in the whole
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};