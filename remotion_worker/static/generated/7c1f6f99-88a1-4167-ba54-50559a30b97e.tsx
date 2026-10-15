import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

export const DURATION_SECONDS = 30;

// Sub-component for rendering a pizza slice with toppings
const PizzaSlice: React.FC<{
  startAngle: number;
  endAngle: number;
  highlighted: boolean;
  highlightColor?: string;
  explodeDistance: number;
  cx: number;
  cy: number;
  radius: number;
  pepperonis: Array<{ rFrac: number; angle: number }>;
}> = ({
  startAngle,
  endAngle,
  highlighted,
  highlightColor = "#FBBF24",
  explodeDistance,
  cx,
  cy,
  radius,
  pepperonis,
}) => {
  const midAngle = ((startAngle + endAngle) / 2) * (Math.PI / 180);
  const offsetX = Math.cos(midAngle) * explodeDistance;
  const offsetY = Math.sin(midAngle) * explodeDistance;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startRad = toRad(startAngle);
  const endRad = toRad(endAngle);

  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);

  const crustRadius = radius + 22;
  const cx1 = cx + crustRadius * Math.cos(startRad);
  const cy1 = cy + crustRadius * Math.sin(startRad);
  const cx2 = cx + crustRadius * Math.cos(endRad);
  const cy2 = cy + crustRadius * Math.sin(endRad);

  // Path for slice cheese body
  const slicePath = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;

  // Path for crust
  const crustPath = `M ${x1} ${y1} L ${cx1} ${cy1} A ${crustRadius} ${crustRadius} 0 0 1 ${cx2} ${cy2} L ${x2} ${y2} A ${radius} ${radius} 0 0 0 ${x1} ${y1} Z`;

  return (
    <g transform={`translate(${offsetX}, ${offsetY})`}>
      {/* Crust */}
      <path
        d={crustPath}
        fill={highlighted ? "#D97706" : "#B45309"}
        stroke="#78350F"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Cheese Base */}
      <path
        d={slicePath}
        fill={highlighted ? highlightColor : "#FDE68A"}
        stroke="#B45309"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      {/* Pepperonis */}
      {pepperonis.map((p, idx) => {
        const pRad = toRad(p.angle);
        const px = cx + radius * p.rFrac * Math.cos(pRad);
        const py = cy + radius * p.rFrac * Math.sin(pRad);
        return (
          <g key={idx}>
            <circle
              cx={px}
              cy={py}
              r="22"
              fill={highlighted ? "#DC2626" : "#EF4444"}
              stroke="#991B1B"
              strokeWidth="4"
            />
            {/* Pepperoni shine */}
            <circle cx={px - 5} cy={py - 5} r="6" fill="#FCA5A5" />
          </g>
        );
      })}
      {/* Little herb flecks */}
      <circle
        cx={cx + radius * 0.5 * Math.cos(toRad((startAngle * 2 + endAngle) / 3))}
        cy={cy + radius * 0.5 * Math.sin(toRad((startAngle * 2 + endAngle) / 3))}
        r="5"
        fill="#15803D"
      />
      <circle
        cx={cx + radius * 0.65 * Math.cos(toRad((startAngle + endAngle * 2) / 3))}
        cy={cy + radius * 0.65 * Math.sin(toRad((startAngle + endAngle * 2) / 3))}
        r="4"
        fill="#16A34A"
      />
    </g>
  );
};

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // SCENE TIMELINE (30 seconds @ 20fps = 600 frames)
  // Scene 1: Whole Pizza (0 -> 130 frames = 6.5s)
  // Scene 2: Cut into 4 Equal Slices (130 -> 250 frames = 6s)
  // Scene 3: Highlight 1 slice -> 1/4 (250 -> 380 frames = 6.5s)
  // Scene 4: Highlight 3 slices -> 3/4 (380 -> 500 frames = 6s)
  // Scene 5: Summary text card (500 -> 600 frames = 5s)

  // Spring entrances
  const introSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Cutter animation for Scene 2 (frames 130-170)
  const cutProgress = interpolate(frame, [130, 165], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slice explosion distance
  // In scene 1: 0
  // In scene 2: slight separation 16px
  // In scene 3: slice 0 pops out further (45px)
  // In scene 4: slices 0, 1, 2 pop out (35px)
  const baseSep = interpolate(frame, [155, 185], [0, 16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slice0Pop = interpolate(frame, [250, 275], [0, 35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slice1Pop = interpolate(frame, [380, 405], [0, 30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const slice2Pop = interpolate(frame, [380, 405], [0, 30], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Highlight status
  const isScene3 = frame >= 250 && frame < 380;
  const isScene4 = frame >= 380 && frame < 500;
  const isScene5 = frame >= 500;

  const s0High = frame >= 250 && frame < 500;
  const s1High = frame >= 380 && frame < 500;
  const s2High = frame >= 380 && frame < 500;
  const s3High = false;

  // Pepperoni placements for each quadrant
  // Quad 0: -90 to 0 (top right)
  const quad0Peps = [
    { rFrac: 0.45, angle: -50 },
    { rFrac: 0.72, angle: -70 },
    { rFrac: 0.7, angle: -25 },
  ];
  // Quad 1: 0 to 90 (bottom right)
  const quad1Peps = [
    { rFrac: 0.45, angle: 40 },
    { rFrac: 0.72, angle: 20 },
    { rFrac: 0.7, angle: 65 },
  ];
  // Quad 2: 90 to 180 (bottom left)
  const quad2Peps = [
    { rFrac: 0.45, angle: 130 },
    { rFrac: 0.72, angle: 110 },
    { rFrac: 0.7, angle: 155 },
  ];
  // Quad 3: 180 to 270 (top left)
  const quad3Peps = [
    { rFrac: 0.45, angle: 220 },
    { rFrac: 0.72, angle: 200 },
    { rFrac: 0.7, angle: 245 },
  ];

  // Right card opacity / transitions
  const cardOpacity = (fStart: number, fEnd: number) => {
    return interpolate(
      frame,
      [fStart, fStart + 12, fEnd - 8, fEnd],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
  };

  const card1Op = cardOpacity(0, 130);
  const card2Op = cardOpacity(130, 250);
  const card3Op = cardOpacity(250, 380);
  const card4Op = cardOpacity(380, 500);
  const card5Op = interpolate(frame, [500, 520], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F172A",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Top Banner Header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 140,
          backgroundColor: "#1E293B",
          borderBottom: "6px solid #38BDF8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: "#F8FAFC",
            letterSpacing: "1px",
          }}
        >
          🍕 Learning Fractions!
        </span>
      </div>

      {/* Main Content Area (Two Columns) */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          width: 1920,
          height: 940,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: 80,
          paddingRight: 80,
        }}
      >
        {/* Left Column: Interactive Pizza Graphic */}
        <div
          style={{
            width: 760,
            height: 760,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transform: `scale(${introSpring})`,
          }}
        >
          {/* Circular wooden board under pizza */}
          <div
            style={{
              position: "absolute",
              width: 700,
              height: 700,
              borderRadius: "50%",
              backgroundColor: "#78350F",
              border: "10px solid #92400E",
              boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
            }}
          />

          <svg
            width="720"
            height="720"
            viewBox="0 0 720 720"
            style={{ position: "relative", zIndex: 2 }}
          >
            {/* Slice 0: Top Right (-90 to 0) */}
            <PizzaSlice
              cx={360}
              cy={360}
              radius={270}
              startAngle={-90}
              endAngle={0}
              highlighted={s0High}
              highlightColor="#F59E0B"
              explodeDistance={baseSep + (isScene3 ? slice0Pop : 0) + (isScene4 ? slice0Pop : 0)}
              pepperonis={quad0Peps}
            />

            {/* Slice 1: Bottom Right (0 to 90) */}
            <PizzaSlice
              cx={360}
              cy={360}
              radius={270}
              startAngle={0}
              endAngle={90}
              highlighted={s1High}
              highlightColor="#F59E0B"
              explodeDistance={baseSep + (isScene4 ? slice1Pop : 0)}
              pepperonis={quad1Peps}
            />

            {/* Slice 2: Bottom Left (90 to 180) */}
            <PizzaSlice
              cx={360}
              cy={360}
              radius={270}
              startAngle={90}
              endAngle={180}
              highlighted={s2High}
              highlightColor="#F59E0B"
              explodeDistance={baseSep + (isScene4 ? slice2Pop : 0)}
              pepperonis={quad2Peps}
            />

            {/* Slice 3: Top Left (180 to 270) */}
            <PizzaSlice
              cx={360}
              cy={360}
              radius={270}
              startAngle={180}
              endAngle={270}
              highlighted={s3High}
              explodeDistance={baseSep}
              pepperonis={quad3Peps}
            />

            {/* Cutting Laser / Knife Line animation in Scene 2 */}
            {cutProgress > 0 && frame < 250 && (
              <>
                {/* Vertical Cut line */}
                <line
                  x1="360"
                  y1={360 - 320 * cutProgress}
                  x2="360"
                  y2={360 + 320 * cutProgress}
                  stroke="#38BDF8"
                  strokeWidth="8"
                  strokeDasharray="14 10"
                />
                {/* Horizontal Cut line */}
                <line
                  x1={360 - 320 * cutProgress}
                  y1="360"
                  x2={360 + 320 * cutProgress}
                  y2="360"
                  stroke="#38BDF8"
                  strokeWidth="8"
                  strokeDasharray="14 10"
                />
              </>
            )}
          </svg>
        </div>

        {/* Right Column: Dynamic Teaching Cards */}
        <div
          style={{
            width: 880,
            height: 720,
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* STEP 1: WHOLE PIZZA */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              opacity: card1Op,
              backgroundColor: "#1E293B",
              borderRadius: 32,
              padding: "48px 56px",
              border: "6px solid #F59E0B",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: 60,
                color: "#FDE68A",
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              Step 1: Start with the Whole
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                color: "#38BDF8",
                marginBottom: 24,
              }}
            >
              1 Whole Pizza
            </div>
            <div
              style={{
                fontSize: 52,
                color: "#E2E8F0",
                lineHeight: 1.4,
              }}
            >
              This is 1 complete object before we divide it into parts.
            </div>
          </div>

          {/* STEP 2: 4 EQUAL SLICES */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              opacity: card2Op,
              backgroundColor: "#1E293B",
              borderRadius: 32,
              padding: "48px 56px",
              border: "6px solid #38BDF8",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: 60,
                color: "#38BDF8",
                fontWeight: 800,
                marginBottom: 20,
              }}
            >
              Step 2: Equal Sharing
            </div>
            <div
              style={{
                fontSize: 84,
                fontWeight: 900,
                color: "#FACC15",
                marginBottom: 24,
              }}
            >
              Cut into 4 Equal Slices!
            </div>
            <div
              style={{
                fontSize: 52,
                color: "#E2E8F0",
                lineHeight: 1.4,
              }}
            >
              Every slice has the exact same size.
              <br />
              Total equal parts = <b style={{ color: "#38BDF8" }}>4</b>
            </div>
          </div>

          {/* STEP 3: 1 SLICE OUT OF 4 = 1/4 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              opacity: card3Op,
              backgroundColor: "#1E293B",
              borderRadius: 32,
              padding: "40px 52px",
              border: "6px solid #10B981",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 40,
            }}
          >
            {/* Giant Fraction Box */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0F172A",
                padding: "24px 44px",
                borderRadius: 24,
                border: "4px solid #10B981",
              }}
            >
              <div
                style={{
                  fontSize: 100,
                  fontWeight: 900,
                  color: "#F59E0B",
                  lineHeight: 1,
                }}
              >
                1
              </div>
              <div
                style={{
                  width: 110,
                  height: 10,
                  backgroundColor: "#F8FAFC",
                  borderRadius: 5,
                  margin: "12px 0",
                }}
              />
              <div
                style={{
                  fontSize: 100,
                  fontWeight: 900,
                  color: "#38BDF8",
                  lineHeight: 1,
                }}
              >
                4
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 68,
                  fontWeight: 900,
                  color: "#10B981",
                  marginBottom: 16,
                }}
              >
                One Fourth (1/4)
              </div>
              <div
                style={{
                  fontSize: 52,
                  color: "#E2E8F0",
                  lineHeight: 1.35,
                }}
              >
                <b style={{ color: "#F59E0B" }}>1 slice</b> is shaded
                <br />
                out of <b style={{ color: "#38BDF8" }}>4 equal slices</b>.
              </div>
            </div>
          </div>

          {/* STEP 4: 3 SLICES OUT OF 4 = 3/4 */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              opacity: card4Op,
              backgroundColor: "#1E293B",
              borderRadius: 32,
              padding: "40px 52px",
              border: "6px solid #EC4899",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 40,
            }}
          >
            {/* Giant Fraction Box */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0F172A",
                padding: "24px 44px",
                borderRadius: 24,
                border: "4px solid #EC4899",
              }}
            >
              <div
                style={{
                  fontSize: 100,
                  fontWeight: 900,
                  color: "#EC4899",
                  lineHeight: 1,
                }}
              >
                3
              </div>
              <div
                style={{
                  width: 110,
                  height: 10,
                  backgroundColor: "#F8FAFC",
                  borderRadius: 5,
                  margin: "12px 0",
                }}
              />
              <div
                style={{
                  fontSize: 100,
                  fontWeight: 900,
                  color: "#38BDF8",
                  lineHeight: 1,
                }}
              >
                4
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 68,
                  fontWeight: 900,
                  color: "#F472B6",
                  marginBottom: 16,
                }}
              >
                Three Fourths (3/4)
              </div>
              <div
                style={{
                  fontSize: 52,
                  color: "#E2E8F0",
                  lineHeight: 1.35,
                }}
              >
                <b style={{ color: "#EC4899" }}>3 slices</b> are shaded
                <br />
                out of <b style={{ color: "#38BDF8" }}>4 equal slices</b>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 5: FINAL FULL SUMMARY OVERLAY */}
      {isScene5 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1920,
            height: 1080,
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            opacity: card5Op,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 36,
              border: "8px solid #F59E0B",
              padding: "60px 80px",
              maxWidth: 1600,
              textAlign: "center",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div
              style={{
                fontSize: 90,
                fontWeight: 900,
                color: "#FCD34D",
                marginBottom: 40,
                lineHeight: 1.2,
              }}
            >
              "A fraction shows a part of a whole."
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 80,
                marginTop: 30,
              }}
            >
              <div
                style={{
                  backgroundColor: "#0F172A",
                  padding: "30px 50px",
                  borderRadius: 24,
                  border: "4px solid #38BDF8",
                }}
              >
                <div style={{ fontSize: 60, fontWeight: 900, color: "#38BDF8" }}>
                  Numerator (Top)
                </div>
                <div style={{ fontSize: 52, color: "#E2E8F0", marginTop: 10 }}>
                  Parts we take or shade
                </div>
              </div>

              <div style={{ fontSize: 70, fontWeight: 900, color: "#94A3B8" }}>
                /
              </div>

              <div
                style={{
                  backgroundColor: "#0F172A",
                  padding: "30px 50px",
                  borderRadius: 24,
                  border: "4px solid #10B981",
                }}
              >
                <div style={{ fontSize: 60, fontWeight: 900, color: "#10B981" }}>
                  Denominator (Bottom)
                </div>
                <div style={{ fontSize: 52, color: "#E2E8F0", marginTop: 10 }}>
                  Total equal parts
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};