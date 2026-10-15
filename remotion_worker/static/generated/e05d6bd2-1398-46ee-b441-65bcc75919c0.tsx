import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const DURATION_SECONDS = 30;

// Reusable Fraction Display Component
const FractionBadge: React.FC<{
  numerator: number | string;
  denominator: number | string;
  numColor?: string;
  denColor?: string;
  size?: number;
}> = ({
  numerator,
  denominator,
  numColor = "#2563EB",
  denColor = "#7C3AED",
  size = 96,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        fontWeight: 800,
        fontSize: `${size}px`,
        lineHeight: 1,
        minWidth: size * 1.1,
      }}
    >
      <span style={{ color: numColor, marginBottom: "8px" }}>{numerator}</span>
      <div
        style={{
          width: "100%",
          height: Math.max(6, Math.round(size * 0.08)),
          backgroundColor: "#1E293B",
          borderRadius: "4px",
          marginBottom: "8px",
        }}
      />
      <span style={{ color: denColor }}>{denominator}</span>
    </div>
  );
};

// SVG Pizza Slice Component (Quarter Wedge with Toppings)
const PizzaSlice: React.FC<{
  rotation: number; // 0, 90, 180, 270
  offsetX: number;
  offsetY: number;
  highlighted: boolean;
  dimmed: boolean;
  radius?: number;
}> = ({
  rotation,
  offsetX,
  offsetY,
  highlighted,
  dimmed,
  radius = 230,
}) => {
  return (
    <g
      transform={`translate(${offsetX}, ${offsetY}) rotate(${rotation})`}
      style={{
        opacity: dimmed ? 0.35 : 1,
        transition: "opacity 0.2s ease",
        filter: highlighted
          ? "drop-shadow(0px 0px 18px rgba(245, 158, 11, 0.9))"
          : "none",
      }}
    >
      {/* Outer Crust */}
      <path
        d={`M 0 0 L ${radius} 0 A ${radius} ${radius} 0 0 1 0 ${radius} Z`}
        fill="#D97706"
        stroke="#B45309"
        strokeWidth="6"
      />
      {/* Inner Cheese / Sauce Layer */}
      <path
        d={`M 0 0 L ${radius - 28} 0 A ${radius - 28} ${radius - 28} 0 0 1 0 ${
          radius - 28
        } Z`}
        fill="#FBBF24"
        stroke="#EA580C"
        strokeWidth="5"
      />
      {/* Melted Cheese Highlights */}
      <path
        d={`M 0 0 L ${radius - 45} 0 A ${radius - 45} ${radius - 45} 0 0 1 0 ${
          radius - 45
        } Z`}
        fill="#FDE68A"
      />

      {/* Pepperoni Toppings */}
      <circle cx="85" cy="55" r="22" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="3" />
      <circle cx="85" cy="55" r="17" fill="#DC2626" opacity={0.8} />

      <circle cx="50" cy="115" r="20" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="3" />
      <circle cx="50" cy="115" r="15" fill="#DC2626" opacity={0.8} />

      <circle cx="120" cy="110" r="23" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="3" />
      <circle cx="120" cy="110" r="18" fill="#DC2626" opacity={0.8} />

      {/* Basil flakes */}
      <ellipse cx="60" cy="40" rx="8" ry="4" fill="#15803D" transform="rotate(25, 60, 40)" />
      <ellipse cx="110" cy="70" rx="7" ry="4" fill="#15803D" transform="rotate(-30, 110, 70)" />
      <ellipse cx="40" cy="85" rx="8" ry="4" fill="#15803D" transform="rotate(45, 40, 85)" />

      {/* Highlight border ring when slice is selected */}
      {highlighted && (
        <path
          d={`M 0 0 L ${radius + 4} 0 A ${radius + 4} ${radius + 4} 0 0 1 0 ${
            radius + 4
          } Z`}
          fill="none"
          stroke="#2563EB"
          strokeWidth="8"
          strokeDasharray="14 8"
        />
      )}
    </g>
  );
};

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Color theme constants
  const bgGradient = "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)";

  return (
    <AbsoluteFill
      style={{
        background: bgGradient,
        fontFamily: "sans-serif",
        color: "#0F172A",
        overflow: "hidden",
      }}
    >
      {/* Top Banner Header (Consistent across all scenes) */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 50,
        }}
      >
        <div
          style={{
            backgroundColor: "#2563EB",
            color: "white",
            fontSize: "36px",
            fontWeight: 800,
            padding: "12px 28px",
            borderRadius: "40px",
            boxShadow: "0 6px 16px rgba(37,99,235,0.25)",
            letterSpacing: "1px",
          }}
        >
          CLASS 5 MATHS • FRACTIONS
        </div>

        <div
          style={{
            fontSize: "34px",
            fontWeight: 700,
            color: "#64748B",
            backgroundColor: "white",
            padding: "10px 24px",
            borderRadius: "30px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          Part of a Whole
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCENE 1: 1 WHOLE PIZZA (Frames 0 - 180 = 0s to 6s)                       */}
      {/* ========================================================================= */}
      <Sequence from={0} durationInFrames={180}>
        {(() => {
          const popIn = spring({
            frame,
            fps,
            config: { damping: 12, stiffness: 90 },
          });

          const labelFade = interpolate(frame, [25, 45], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <AbsoluteFill style={{ display: "flex", flexDirection: "row", padding: "120px 80px 40px" }}>
              {/* Left Column: Whole Pizza */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    transform: `scale(${popIn})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="540" height="540" viewBox="-270 -270 540 540">
                    <PizzaSlice rotation={0} offsetX={0} offsetY={0} highlighted={false} dimmed={false} />
                    <PizzaSlice rotation={90} offsetX={0} offsetY={0} highlighted={false} dimmed={false} />
                    <PizzaSlice rotation={180} offsetX={0} offsetY={0} highlighted={false} dimmed={false} />
                    <PizzaSlice rotation={270} offsetX={0} offsetY={0} highlighted={false} dimmed={false} />
                  </svg>
                </div>
              </div>

              {/* Right Column: Explanatory Card */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  opacity: labelFade,
                  paddingLeft: "40px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "32px",
                    padding: "54px 50px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
                    border: "4px solid #F59E0B",
                    maxWidth: "680px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: 800,
                      color: "#EA580C",
                      marginBottom: "16px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Step 1
                  </div>
                  <div
                    style={{
                      fontSize: "82px",
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1.1,
                      marginBottom: "24px",
                    }}
                  >
                    1 Whole Pizza
                  </div>
                  <div
                    style={{
                      fontSize: "44px",
                      color: "#475569",
                      lineHeight: 1.4,
                      fontWeight: 500,
                    }}
                  >
                    Before cutting, we have <strong>one complete</strong> unit:
                  </div>
                  <div
                    style={{
                      marginTop: "28px",
                      fontSize: "58px",
                      fontWeight: 800,
                      color: "#2563EB",
                      backgroundColor: "#EFF6FF",
                      padding: "16px 32px",
                      borderRadius: "20px",
                      display: "inline-block",
                    }}
                  >
                    1 Whole = 1
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ========================================================================= */}
      {/* SCENE 2: CUTTING INTO 4 EQUAL SLICES (Frames 180 - 360 = 6s to 12s)       */}
      {/* ========================================================================= */}
      <Sequence from={180} durationInFrames={180}>
        {(() => {
          const localFrame = frame - 180;

          // Separation expansion animation
          const separation = interpolate(localFrame, [15, 60], [0, 26], {
            easing: Easing.out(Easing.back(1.5)),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Cutter lines dash animation
          const cutProgress = interpolate(localFrame, [5, 35], [0, 540], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const textFade = interpolate(localFrame, [35, 55], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <AbsoluteFill style={{ display: "flex", flexDirection: "row", padding: "120px 80px 40px" }}>
              {/* Left Column: Slicing Pizza */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <svg width="600" height="600" viewBox="-300 -300 600 600">
                  {/* Slices separating outwards */}
                  {/* Slice 1: Top-Right */}
                  <PizzaSlice
                    rotation={0}
                    offsetX={separation}
                    offsetY={separation}
                    highlighted={false}
                    dimmed={false}
                  />
                  {/* Slice 2: Bottom-Right */}
                  <PizzaSlice
                    rotation={90}
                    offsetX={-separation}
                    offsetY={separation}
                    highlighted={false}
                    dimmed={false}
                  />
                  {/* Slice 3: Bottom-Left */}
                  <PizzaSlice
                    rotation={180}
                    offsetX={-separation}
                    offsetY={-separation}
                    highlighted={false}
                    dimmed={false}
                  />
                  {/* Slice 4: Top-Left */}
                  <PizzaSlice
                    rotation={270}
                    offsetX={separation}
                    offsetY={-separation}
                    highlighted={false}
                    dimmed={false}
                  />

                  {/* Knife cut visual guides */}
                  {localFrame < 50 && (
                    <g stroke="#DC2626" strokeWidth="6" strokeDasharray="16 10">
                      <line x1="-270" y1="0" x2={-270 + cutProgress} y2="0" />
                      <line x1="0" y1="-270" x2="0" y2={-270 + cutProgress} />
                    </g>
                  )}
                </svg>
              </div>

              {/* Right Column: Explanatory Card */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  opacity: textFade,
                  paddingLeft: "40px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "32px",
                    padding: "54px 50px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
                    border: "4px solid #3B82F6",
                    maxWidth: "680px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      fontWeight: 800,
                      color: "#2563EB",
                      marginBottom: "16px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    Step 2: Divide
                  </div>
                  <div
                    style={{
                      fontSize: "78px",
                      fontWeight: 900,
                      color: "#0F172A",
                      lineHeight: 1.15,
                      marginBottom: "24px",
                    }}
                  >
                    4 Equal Slices
                  </div>
                  <div
                    style={{
                      fontSize: "44px",
                      color: "#334155",
                      lineHeight: 1.4,
                      fontWeight: 500,
                    }}
                  >
                    The whole pizza is cut into <strong>4 equal parts</strong>.
                  </div>
                  <div
                    style={{
                      marginTop: "30px",
                      fontSize: "46px",
                      fontWeight: 800,
                      color: "#7C3AED",
                      backgroundColor: "#F5F3FF",
                      padding: "16px 28px",
                      borderRadius: "20px",
                      display: "inline-block",
                    }}
                  >
                    Total Equal Parts = 4
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ========================================================================= */}
      {/* SCENE 3: SHADING 1 SLICE -> 1/4 (Frames 360 - 540 = 12s to 18s)           */}
      {/* ========================================================================= */}
      <Sequence from={360} durationInFrames={180}>
        {(() => {
          const localFrame = frame - 360;

          // Pull selected slice further out
          const extraOffset = interpolate(localFrame, [0, 25], [0, 40], {
            easing: Easing.out(Easing.cubic),
            extrapolateRight: "clamp",
          });

          const baseOffset = 26;

          const cardSpring = spring({
            frame: localFrame - 10,
            fps,
            config: { damping: 14, stiffness: 100 },
          });

          return (
            <AbsoluteFill style={{ display: "flex", flexDirection: "row", padding: "120px 80px 40px" }}>
              {/* Left Column: 1 Slice highlighted */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="620" height="620" viewBox="-310 -310 620 620">
                  {/* Slice 1 (Top-Right): SELECTED / HIGHLIGHTED */}
                  <PizzaSlice
                    rotation={0}
                    offsetX={baseOffset + extraOffset}
                    offsetY={baseOffset + extraOffset}
                    highlighted={true}
                    dimmed={false}
                  />
                  {/* Other 3 slices dimmed */}
                  <PizzaSlice
                    rotation={90}
                    offsetX={-baseOffset}
                    offsetY={baseOffset}
                    highlighted={false}
                    dimmed={true}
                  />
                  <PizzaSlice
                    rotation={180}
                    offsetX={-baseOffset}
                    offsetY={-baseOffset}
                    highlighted={false}
                    dimmed={true}
                  />
                  <PizzaSlice
                    rotation={270}
                    offsetX={baseOffset}
                    offsetY={-baseOffset}
                    highlighted={false}
                    dimmed={true}
                  />
                </svg>
              </div>

              {/* Right Column: Fraction Explanation for 1/4 */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  transform: `scale(${cardSpring})`,
                  opacity: Math.max(0, Math.min(1, cardSpring)),
                  paddingLeft: "40px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "32px",
                    padding: "48px 50px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
                    border: "4px solid #2563EB",
                    maxWidth: "700px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "40px",
                      marginBottom: "28px",
                    }}
                  >
                    <FractionBadge numerator="1" denominator="4" size={110} />

                    <div>
                      <div
                        style={{
                          fontSize: "64px",
                          fontWeight: 900,
                          color: "#1E293B",
                          lineHeight: 1.1,
                        }}
                      >
                        One Fourth
                      </div>
                      <div
                        style={{
                          fontSize: "36px",
                          fontWeight: 700,
                          color: "#64748B",
                          marginTop: "6px",
                        }}
                      >
                        (or &ldquo;One Quarter&rdquo;)
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "3px solid #E2E8F0",
                      paddingTop: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div
                        style={{
                          backgroundColor: "#DBEAFE",
                          color: "#1D4ED8",
                          fontSize: "36px",
                          fontWeight: 800,
                          padding: "6px 18px",
                          borderRadius: "12px",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        1
                      </div>
                      <div style={{ fontSize: "44px", color: "#334155", fontWeight: 600 }}>
                        Numerator: <strong>1 slice shaded</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div
                        style={{
                          backgroundColor: "#EDE9FE",
                          color: "#6D28D9",
                          fontSize: "36px",
                          fontWeight: 800,
                          padding: "6px 18px",
                          borderRadius: "12px",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        4
                      </div>
                      <div style={{ fontSize: "44px", color: "#334155", fontWeight: 600 }}>
                        Denominator: <strong>4 equal parts</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ========================================================================= */}
      {/* SCENE 4: SHADING 3 SLICES -> 3/4 (Frames 540 - 720 = 18s to 24s)          */}
      {/* ========================================================================= */}
      <Sequence from={540} durationInFrames={180}>
        {(() => {
          const localFrame = frame - 540;

          const popIn = spring({
            frame: localFrame - 5,
            fps,
            config: { damping: 14, stiffness: 100 },
          });

          const baseOffset = 26;
          const pullOffset = 36;

          return (
            <AbsoluteFill style={{ display: "flex", flexDirection: "row", padding: "120px 80px 40px" }}>
              {/* Left Column: 3 Slices highlighted */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="620" height="620" viewBox="-310 -310 620 620">
                  {/* Slice 1: Highlighted */}
                  <PizzaSlice
                    rotation={0}
                    offsetX={baseOffset + pullOffset}
                    offsetY={baseOffset + pullOffset}
                    highlighted={true}
                    dimmed={false}
                  />
                  {/* Slice 2: Highlighted */}
                  <PizzaSlice
                    rotation={90}
                    offsetX={-baseOffset - pullOffset}
                    offsetY={baseOffset + pullOffset}
                    highlighted={true}
                    dimmed={false}
                  />
                  {/* Slice 3: Highlighted */}
                  <PizzaSlice
                    rotation={180}
                    offsetX={-baseOffset - pullOffset}
                    offsetY={-baseOffset - pullOffset}
                    highlighted={true}
                    dimmed={false}
                  />
                  {/* Slice 4 (Top-Left): Dimmed / Not selected */}
                  <PizzaSlice
                    rotation={270}
                    offsetX={baseOffset}
                    offsetY={-baseOffset}
                    highlighted={false}
                    dimmed={true}
                  />
                </svg>
              </div>

              {/* Right Column: Fraction Explanation for 3/4 */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  transform: `scale(${popIn})`,
                  opacity: Math.max(0, Math.min(1, popIn)),
                  paddingLeft: "40px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "white",
                    borderRadius: "32px",
                    padding: "48px 50px",
                    boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
                    border: "4px solid #10B981",
                    maxWidth: "700px",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "40px",
                      marginBottom: "28px",
                    }}
                  >
                    <FractionBadge
                      numerator="3"
                      denominator="4"
                      numColor="#059669"
                      denColor="#7C3AED"
                      size={110}
                    />

                    <div>
                      <div
                        style={{
                          fontSize: "64px",
                          fontWeight: 900,
                          color: "#1E293B",
                          lineHeight: 1.1,
                        }}
                      >
                        Three Fourths
                      </div>
                      <div
                        style={{
                          fontSize: "36px",
                          fontWeight: 700,
                          color: "#64748B",
                          marginTop: "6px",
                        }}
                      >
                        (or &ldquo;Three Quarters&rdquo;)
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderTop: "3px solid #E2E8F0",
                      paddingTop: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div
                        style={{
                          backgroundColor: "#D1FAE5",
                          color: "#059669",
                          fontSize: "36px",
                          fontWeight: 800,
                          padding: "6px 18px",
                          borderRadius: "12px",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        3
                      </div>
                      <div style={{ fontSize: "44px", color: "#334155", fontWeight: 600 }}>
                        Numerator: <strong>3 slices shaded</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div
                        style={{
                          backgroundColor: "#EDE9FE",
                          color: "#6D28D9",
                          fontSize: "36px",
                          fontWeight: 800,
                          padding: "6px 18px",
                          borderRadius: "12px",
                          minWidth: "60px",
                          textAlign: "center",
                        }}
                      >
                        4
                      </div>
                      <div style={{ fontSize: "44px", color: "#334155", fontWeight: 600 }}>
                        Denominator: <strong>4 total equal parts</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ========================================================================= */}
      {/* SCENE 5: SUMMARY CARD & TAKEAWAY (Frames 720 - 900 = 24s to 30s)           */}
      {/* ========================================================================= */}
      <Sequence from={720} durationInFrames={180}>
        {(() => {
          const localFrame = frame - 720;

          const scaleSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 14, stiffness: 90 },
          });

          const recapFade = interpolate(localFrame, [20, 45], [0, 1], {
            extrapolateRight: "clamp",
          });

          return (
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px",
              }}
            >
              <div
                style={{
                  transform: `scale(${scaleSpring})`,
                  backgroundColor: "white",
                  borderRadius: "36px",
                  padding: "54px 70px",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.12)",
                  border: "6px solid #2563EB",
                  textAlign: "center",
                  maxWidth: "1500px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    backgroundColor: "#EFF6FF",
                    color: "#2563EB",
                    fontSize: "34px",
                    fontWeight: 800,
                    padding: "10px 28px",
                    borderRadius: "20px",
                    marginBottom: "20px",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                  }}
                >
                  Key Takeaway
                </div>

                <div
                  style={{
                    fontSize: "84px",
                    fontWeight: 900,
                    color: "#0F172A",
                    lineHeight: 1.25,
                    marginBottom: "36px",
                  }}
                >
                  &ldquo;A fraction shows a part of a whole.&rdquo;
                </div>

                {/* Recap pills */}
                <div
                  style={{
                    opacity: recapFade,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "60px",
                    marginTop: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "24px",
                      backgroundColor: "#F8FAFC",
                      padding: "20px 36px",
                      borderRadius: "24px",
                      border: "3px solid #E2E8F0",
                    }}
                  >
                    <FractionBadge numerator="1" denominator="4" size={72} />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "44px", fontWeight: 800, color: "#1E293B" }}>
                        1 slice
                      </div>
                      <div style={{ fontSize: "36px", color: "#64748B" }}>out of 4</div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "64px",
                      fontWeight: 900,
                      color: "#94A3B8",
                    }}
                  >
                    +
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "24px",
                      backgroundColor: "#F8FAFC",
                      padding: "20px 36px",
                      borderRadius: "24px",
                      border: "3px solid #E2E8F0",
                    }}
                  >
                    <FractionBadge numerator="3" denominator="4" numColor="#059669" size={72} />
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: "44px", fontWeight: 800, color: "#1E293B" }}>
                        3 slices
                      </div>
                      <div style={{ fontSize: "36px", color: "#64748B" }}>out of 4</div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "64px",
                      fontWeight: 900,
                      color: "#94A3B8",
                    }}
                  >
                    =
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "20px",
                      backgroundColor: "#FEF3C7",
                      padding: "20px 36px",
                      borderRadius: "24px",
                      border: "3px solid #F59E0B",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "56px",
                        fontWeight: 900,
                        color: "#B45309",
                      }}
                    >
                      1 Whole
                    </div>
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>
    </AbsoluteFill>
  );
};