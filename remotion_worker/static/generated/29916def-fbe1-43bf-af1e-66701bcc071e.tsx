import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
} from "remotion";

export const DURATION_SECONDS = 45;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background styling constant
  const bgStyle: React.CSSProperties = {
    backgroundColor: "#0a192f",
    color: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  return (
    <AbsoluteFill style={bgStyle}>
      {/* Background ambient grid pattern */}
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", opacity: 0.12 }}
      >
        <defs>
          <pattern
            id="grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#grid)" />
      </svg>

      {/* =================================================== */}
      {/* SCENE 1: TITLE CARD (0s - 6s, frames 0 to 120)     */}
      {/* =================================================== */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* =================================================== */}
      {/* SCENE 2, 3 & 4: THE INTERACTIVE DIAGRAM & EQUATIONS */}
      {/* (6s - 38s, frames 120 to 760)                       */}
      {/* =================================================== */}
      <Sequence from={120} durationInFrames={640}>
        <MainExplorationScene />
      </Sequence>

      {/* =================================================== */}
      {/* SCENE 5: SUMMARY CARD (38s - 45s, frames 760 to 900)*/}
      {/* =================================================== */}
      <Sequence from={760} durationInFrames={140}>
        <SummaryScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ============================================================
// SCENE 1: Title Screen
// ============================================================
const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [5, 25], [40, 0], {
    extrapolateRight: "clamp",
  });

  const subOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subY = interpolate(frame, [25, 45], [30, 0], {
    extrapolateRight: "clamp",
  });

  const badgeScale = interpolate(frame, [45, 65], [0.7, 1], {
    extrapolateRight: "clamp",
  });
  const badgeOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [105, 120], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          backgroundColor: "#1e293b",
          border: "2px solid #38bdf8",
          padding: "12px 32px",
          borderRadius: 40,
          fontSize: 34,
          fontWeight: 600,
          color: "#38bdf8",
          marginBottom: 30,
          letterSpacing: 2,
        }}
      >
        CLASS 8 MATHEMATICS
      </div>

      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: 90,
          fontWeight: 800,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 8px 24px rgba(0,0,0,0.5)",
          lineHeight: 1.15,
        }}
      >
        The Pythagorean Theorem
      </div>

      <div
        style={{
          opacity: subOpacity,
          transform: `translateY(${subY}px)`,
          fontSize: 44,
          color: "#94a3b8",
          marginTop: 28,
          fontWeight: 400,
        }}
      >
        Discovering the relationship between the sides of a right triangle
      </div>
    </AbsoluteFill>
  );
};

// ============================================================
// MAIN EXPLORATION (Triangle -> Squares -> Formula)
// ============================================================
const MainExplorationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit fade
  const sceneOpacity = interpolate(frame, [0, 15, 620, 640], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Step Indicators & Timing:
  // Phase 1 (f 0 - 180): Draw Triangle & side lengths
  // Phase 2 (f 180 - 400): Reveal Squares on sides and their areas (9, 16, 25)
  // Phase 3 (f 400 - 640): Derive equation a² + b² = c² -> 9 + 16 = 25

  // Triangle side draw animations
  const drawSideA = interpolate(frame, [15, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drawSideB = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drawSideC = interpolate(frame, [55, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Labels for sides
  const labelAOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelBOpacity = interpolate(frame, [60, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelCOpacity = interpolate(frame, [80, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Right angle symbol
  const rightAngleOpacity = interpolate(frame, [70, 85], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // SQUARES ENTRANCE (Phase 2, starts around frame 180)
  const squareAScale = spring({
    frame: frame - 190,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const squareBScale = spring({
    frame: frame - 250,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const squareCScale = spring({
    frame: frame - 310,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const sqAClamped = Math.max(0, Math.min(1, squareAScale));
  const sqBClamped = Math.max(0, Math.min(1, squareBScale));
  const sqCClamped = Math.max(0, Math.min(1, squareCScale));

  // EQUATION PHASES (Phase 3, starts frame 400)
  const eq1Opacity = interpolate(frame, [405, 420], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eq2Opacity = interpolate(frame, [460, 475], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eq3Opacity = interpolate(frame, [515, 530], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eq4Opacity = interpolate(frame, [565, 580], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Coordinates for the 3-4-5 Triangle:
  // Base scale factor: 1 unit = 50px
  // Right Angle Corner (V_R): (560, 680)
  // Top Corner (V_T): (560, 680 - 3*50) = (560, 530) -> Side a = 150px
  // Bottom-Right Corner (V_B): (560 + 4*50, 680) = (760, 680) -> Side b = 200px
  // Hypotenuse length c = 5*50 = 250px

  const VR = { x: 560, y: 680 };
  const VT = { x: 560, y: 530 };
  const VB = { x: 760, y: 680 };

  // Square A points (left of side a):
  // (560, 530) -> (410, 530) -> (410, 680) -> (560, 680)
  // Center of Square A: (485, 605)

  // Square B points (below side b):
  // (560, 680) -> (760, 680) -> (760, 880) -> (560, 880)
  // Center of Square B: (660, 780)

  // Square C points (perpendicular out from hypotenuse VT to VB):
  // Vector VT->VB is (200, 150). Perpendicular vector pointing outward-up is (150, -200).
  // VT -> (560+150, 530-200) = (710, 330)
  // VB -> (760+150, 680-200) = (910, 480)
  // Center of Square C: (735, 505)

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity,
        padding: "50px 80px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Header Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid rgba(148, 163, 184, 0.25)",
          paddingBottom: 20,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 800, color: "#f8fafc" }}>
          The 3 - 4 - 5 Right Triangle
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: frame < 180 ? "#38bdf8" : frame < 400 ? "#fbbf24" : "#4ade80",
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            padding: "8px 24px",
            borderRadius: 24,
            border: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          {frame < 180
            ? "Step 1: Identifying Sides"
            : frame < 400
            ? "Step 2: Constructing Squares"
            : "Step 3: Calculating Areas"}
        </div>
      </div>

      {/* Main Content: Left = Diagram, Right = Explanations & Equations */}
      <div style={{ display: "flex", flex: 1, marginTop: 30 }}>
        {/* LEFT COLUMN: SVG DIAGRAM CANVAS */}
        <div
          style={{
            width: 1000,
            height: 840,
            position: "relative",
          }}
        >
          <svg
            width="1000"
            height="840"
            style={{ overflow: "visible" }}
          >
            {/* Square A on Side a (Area = 9) */}
            <g
              transform={`translate(485, 605) scale(${sqAClamped}) translate(-485, -605)`}
              opacity={sqAClamped}
            >
              <polygon
                points="560,530 410,530 410,680 560,680"
                fill="#f43f5e"
                fillOpacity="0.35"
                stroke="#f43f5e"
                strokeWidth="4"
              />
              <text
                x="485"
                y="595"
                fill="#ffffff"
                fontSize="42"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                Area
              </text>
              <text
                x="485"
                y="640"
                fill="#fda4af"
                fontSize="48"
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="central"
              >
                9
              </text>
            </g>

            {/* Square B on Side b (Area = 16) */}
            <g
              transform={`translate(660, 780) scale(${sqBClamped}) translate(-660, -780)`}
              opacity={sqBClamped}
            >
              <polygon
                points="560,680 760,680 760,880 560,880"
                fill="#0284c7"
                fillOpacity="0.35"
                stroke="#38bdf8"
                strokeWidth="4"
              />
              <text
                x="660"
                y="765"
                fill="#ffffff"
                fontSize="42"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                Area
              </text>
              <text
                x="660"
                y="815"
                fill="#bae6fd"
                fontSize="48"
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="central"
              >
                16
              </text>
            </g>

            {/* Square C on Hypotenuse (Area = 25) */}
            <g
              transform={`translate(735, 505) scale(${sqCClamped}) translate(-735, -505)`}
              opacity={sqCClamped}
            >
              <polygon
                points="560,530 760,680 910,480 710,330"
                fill="#16a34a"
                fillOpacity="0.35"
                stroke="#4ade80"
                strokeWidth="4"
              />
              <text
                x="735"
                y="485"
                fill="#ffffff"
                fontSize="42"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                Area
              </text>
              <text
                x="735"
                y="535"
                fill="#bbf7d0"
                fontSize="52"
                fontWeight="900"
                textAnchor="middle"
                dominantBaseline="central"
              >
                25
              </text>
            </g>

            {/* Triangle Body Fill */}
            <polygon
              points="560,530 760,680 560,680"
              fill="#1e293b"
              stroke="#64748b"
              strokeWidth="2"
            />

            {/* Side A Line (Height = 3 units) */}
            <line
              x1={VR.x}
              y1={VR.y}
              x2={VR.x}
              y2={VR.y - 150 * drawSideA}
              stroke="#fb7185"
              strokeWidth="7"
              strokeLinecap="round"
            />

            {/* Side B Line (Base = 4 units) */}
            <line
              x1={VR.x}
              y1={VR.y}
              x2={VR.x + 200 * drawSideB}
              y2={VR.y}
              stroke="#38bdf8"
              strokeWidth="7"
              strokeLinecap="round"
            />

            {/* Side C Line (Hypotenuse = 5 units) */}
            <line
              x1={VT.x}
              y1={VT.y}
              x2={VT.x + 200 * drawSideC}
              y2={VT.y + 150 * drawSideC}
              stroke="#4ade80"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Right Angle Indicator at (560, 680) */}
            <g opacity={rightAngleOpacity}>
              <polyline
                points="560,650 590,650 590,680"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.5"
              />
              <circle cx="575" cy="665" r="3" fill="#ffffff" />
            </g>

            {/* Side Labels on Diagram */}
            {/* Label a = 3 */}
            <g opacity={labelAOpacity}>
              <rect
                x="500"
                y="585"
                width="110"
                height="46"
                rx="10"
                fill="#1e1b4b"
                stroke="#fb7185"
                strokeWidth="2"
              />
              <text
                x="555"
                y="615"
                fill="#ffffff"
                fontSize="28"
                fontWeight="800"
                textAnchor="middle"
              >
                a = 3
              </text>
            </g>

            {/* Label b = 4 */}
            <g opacity={labelBOpacity}>
              <rect
                x="620"
                y="695"
                width="110"
                height="46"
                rx="10"
                fill="#082f49"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <text
                x="675"
                y="727"
                fill="#ffffff"
                fontSize="28"
                fontWeight="800"
                textAnchor="middle"
              >
                b = 4
              </text>
            </g>

            {/* Label c = 5 (Hypotenuse) */}
            <g opacity={labelCOpacity}>
              <rect
                x="680"
                y="565"
                width="120"
                height="46"
                rx="10"
                fill="#052e16"
                stroke="#4ade80"
                strokeWidth="2"
              />
              <text
                x="740"
                y="597"
                fill="#ffffff"
                fontSize="28"
                fontWeight="800"
                textAnchor="middle"
              >
                c = 5
              </text>
            </g>
          </svg>
        </div>

        {/* RIGHT COLUMN: STEP-BY-STEP EXPLANATION & EQUATIONS */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: 40,
          }}
        >
          {/* SIDES SUMMARY CARDS */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 35,
              opacity: labelCOpacity,
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(244, 63, 94, 0.15)",
                border: "2px solid #f43f5e",
                borderRadius: 16,
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, color: "#fda4af" }}>Side a</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#ffffff" }}>
                3
              </div>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                border: "2px solid #38bdf8",
                borderRadius: 16,
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 26, color: "#bae6fd" }}>Side b</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#ffffff" }}>
                4
              </div>
            </div>

            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(74, 222, 128, 0.15)",
                border: "2px solid #4ade80",
                borderRadius: 16,
                padding: "16px 20px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 24, color: "#bbf7d0" }}>Hypotenuse (c)</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: "#ffffff" }}>
                5
              </div>
            </div>
          </div>

          {/* EQUATION STEP CONTAINER */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 24,
              border: "2px solid #334155",
              padding: "36px 40px",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: 32,
                color: "#94a3b8",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              The Formula
            </div>

            {/* 1. a² + b² = c² */}
            <div
              style={{
                opacity: eq1Opacity,
                fontSize: 54,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span style={{ color: "#fb7185" }}>a²</span>
              <span style={{ color: "#ffffff" }}>+</span>
              <span style={{ color: "#38bdf8" }}>b²</span>
              <span style={{ color: "#ffffff" }}>=</span>
              <span style={{ color: "#4ade80" }}>c²</span>
            </div>

            {/* 2. Plug in side values: 3² + 4² = 5² */}
            <div
              style={{
                opacity: eq2Opacity,
                fontSize: 48,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 16,
                color: "#cbd5e1",
              }}
            >
              <span style={{ color: "#fda4af" }}>3²</span>
              <span>+</span>
              <span style={{ color: "#bae6fd" }}>4²</span>
              <span>=</span>
              <span style={{ color: "#bbf7d0" }}>5²</span>
            </div>

            {/* 3. Areas calculated: 9 + 16 = 25 */}
            <div
              style={{
                opacity: eq3Opacity,
                fontSize: 52,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span
                style={{
                  backgroundColor: "rgba(244,63,94,0.3)",
                  padding: "4px 18px",
                  borderRadius: 12,
                  color: "#fda4af",
                }}
              >
                9
              </span>
              <span>+</span>
              <span
                style={{
                  backgroundColor: "rgba(14,165,233,0.3)",
                  padding: "4px 18px",
                  borderRadius: 12,
                  color: "#bae6fd",
                }}
              >
                16
              </span>
              <span>=</span>
              <span
                style={{
                  backgroundColor: "rgba(34,197,94,0.3)",
                  padding: "4px 18px",
                  borderRadius: 12,
                  color: "#86efac",
                }}
              >
                25
              </span>
            </div>

            {/* 4. Verification Check: 25 = 25 */}
            <div
              style={{
                opacity: eq4Opacity,
                fontSize: 46,
                fontWeight: 800,
                color: "#4ade80",
                display: "flex",
                alignItems: "center",
                gap: 16,
                paddingTop: 10,
                borderTop: "1px solid #334155",
              }}
            >
              <span>25 = 25</span>
              <span
                style={{
                  backgroundColor: "#22c55e",
                  color: "#ffffff",
                  fontSize: 28,
                  padding: "4px 16px",
                  borderRadius: 20,
                  marginLeft: 12,
                }}
              >
                ✓ It Works!
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================
// SCENE 5: Final Summary Screen
// ============================================================
const SummaryScene: React.FC = () => {
  const frame = useCurrentFrame();

  const cardOpacity = interpolate(frame, [5, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const cardScale = interpolate(frame, [5, 25], [0.92, 1], {
    extrapolateRight: "clamp",
  });

  const statementOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const formulaOpacity = interpolate(frame, [45, 65], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 140px",
      }}
    >
      <div
        style={{
          opacity: cardOpacity,
          transform: `scale(${cardScale})`,
          backgroundColor: "#0f172a",
          border: "3px solid #38bdf8",
          borderRadius: 36,
          padding: "60px 80px",
          textAlign: "center",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
          maxWidth: 1600,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            color: "#38bdf8",
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom: 24,
          }}
        >
          Key Takeaway
        </div>

        <div
          style={{
            opacity: statementOpacity,
            fontSize: 50,
            lineHeight: 1.45,
            color: "#ffffff",
            fontWeight: 600,
            marginBottom: 44,
          }}
        >
          “In a right-angled triangle, the square of the hypotenuse equals the
          sum of the squares of the other two sides.”
        </div>

        <div
          style={{
            opacity: formulaOpacity,
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            backgroundColor: "#1e293b",
            border: "2px solid #4ade80",
            padding: "20px 60px",
            borderRadius: 28,
          }}
        >
          <span style={{ fontSize: 68, fontWeight: 900, color: "#4ade80" }}>
            a² + b² = c²
          </span>
          <span style={{ fontSize: 44, color: "#94a3b8", marginLeft: 16 }}>
            (3² + 4² = 5²)
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};