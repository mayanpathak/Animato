import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from "remotion";

export const DURATION_SECONDS = 40;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Coordinate conversion helpers
  // SVG Canvas: width: 960, height: 860
  // Origin (0,0) at (240, 640)
  // 1 unit in x = 120px
  // 1 unit in y = 84px
  const originX = 240;
  const originY = 640;
  const unitX = 120;
  const unitY = 84;

  const toSvgX = (x: number) => originX + x * unitX;
  const toSvgY = (y: number) => originY - y * unitY;

  // Title entrance
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 30], [-20, 0], {
    extrapolateRight: "clamp",
  });

  // Grid and axes entrance (frames 20 - 70)
  const axesProgress = interpolate(frame, [20, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Parabola drawing (frames 90 - 240)
  const parabolaT = interpolate(frame, [90, 230], [-0.6, 4.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const curvePoints = useMemo(() => {
    const pts: { x: number; y: number; svgX: number; svgY: number }[] = [];
    const step = 0.04;
    for (let x = -0.6; x <= 4.601; x += step) {
      const y = x * x - 4 * x + 3;
      pts.push({ x, y, svgX: toSvgX(x), svgY: toSvgY(y) });
    }
    return pts;
  }, []);

  const visibleCurvePath = useMemo(() => {
    const active = curvePoints.filter((p) => p.x <= parabolaT);
    if (active.length === 0) return "";
    return active.reduce(
      (acc, p, idx) =>
        idx === 0
          ? `M ${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`
          : `${acc} L ${p.svgX.toFixed(1)} ${p.svgY.toFixed(1)}`,
      ""
    );
  }, [curvePoints, parabolaT]);

  // Step 1: Roots (frames 250 - 480)
  const rootsSpring = spring({
    frame: frame - 250,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const rootsOpacity = interpolate(frame, [250, 270], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Step 2: Vertex (frames 480 - 700)
  const vertexSpring = spring({
    frame: frame - 480,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const vertexOpacity = interpolate(frame, [480, 500], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Step 3: Axis of Symmetry (frames 700 - 920)
  const axisSymLength = interpolate(frame, [700, 750], [0, 680], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const axisSymOpacity = interpolate(frame, [700, 725], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final Summary Spotlight (frames 920 - 1200)
  const summaryHighlight = interpolate(frame, [920, 950], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid tick ranges
  const xTicks = [-1, 0, 1, 2, 3, 4, 5];
  const yTicks = [-2, -1, 0, 1, 2, 3, 4, 5, 6];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0F172A",
        padding: "40px 60px",
        boxSizing: "border-box",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          marginBottom: "20px",
        }}
      >
        <div style={{ fontSize: 80, fontWeight: 900, color: "#0F172A", lineHeight: 1.1 }}>
          Graph of a Quadratic Function
        </div>
        <div style={{ fontSize: 44, color: "#2563EB", fontWeight: 700, marginTop: 4 }}>
          y = x² − 4x + 3
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "48px",
          alignItems: "flex-start",
          height: "880px",
        }}
      >
        {/* Left Side: Coordinate Grid SVG */}
        <div
          style={{
            width: "980px",
            height: "860px",
            backgroundColor: "#F8FAFC",
            borderRadius: "24px",
            border: "3px solid #E2E8F0",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <svg
            width="980"
            height="860"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {/* Background Grid */}
            <g opacity={axesProgress * 0.7}>
              {xTicks.map((x) => (
                <line
                  key={`vgrid-${x}`}
                  x1={toSvgX(x)}
                  y1={40}
                  x2={toSvgX(x)}
                  y2={820}
                  stroke="#CBD5E1"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              ))}
              {yTicks.map((y) => (
                <line
                  key={`hgrid-${y}`}
                  x1={80}
                  y1={toSvgY(y)}
                  x2={920}
                  y2={toSvgY(y)}
                  stroke="#CBD5E1"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              ))}
            </g>

            {/* X and Y Axes */}
            <g opacity={axesProgress}>
              {/* X Axis */}
              <line
                x1={80}
                y1={originY}
                x2={920}
                y2={originY}
                stroke="#334155"
                strokeWidth="4"
              />
              <polygon
                points={`930,${originY} 915,${originY - 8} 915,${originY + 8}`}
                fill="#334155"
              />
              <text
                x="935"
                y={originY + 12}
                fontSize="44"
                fontWeight="700"
                fill="#334155"
              >
                x
              </text>

              {/* Y Axis */}
              <line
                x1={originX}
                y1={820}
                x2={originX}
                y2={60}
                stroke="#334155"
                strokeWidth="4"
              />
              <polygon
                points={`${originX},50 ${originX - 8},65 ${originX + 8},65`}
                fill="#334155"
              />
              <text
                x={originX - 44}
                y="55"
                fontSize="44"
                fontWeight="700"
                fill="#334155"
              >
                y
              </text>

              {/* Numbers on X Axis */}
              {xTicks.map(
                (x) =>
                  x !== 0 && (
                    <text
                      key={`lbl-x-${x}`}
                      x={toSvgX(x)}
                      y={originY + 44}
                      fontSize="36"
                      fontWeight="600"
                      fill="#64748B"
                      textAnchor="middle"
                    >
                      {x}
                    </text>
                  )
              )}

              {/* Numbers on Y Axis */}
              {yTicks.map(
                (y) =>
                  y !== 0 && (
                    <text
                      key={`lbl-y-${y}`}
                      x={originX - 18}
                      y={toSvgY(y) + 12}
                      fontSize="36"
                      fontWeight="600"
                      fill="#64748B"
                      textAnchor="end"
                    >
                      {y}
                    </text>
                  )
              )}
              {/* Origin label */}
              <text
                x={originX - 22}
                y={originY + 36}
                fontSize="36"
                fontWeight="600"
                fill="#64748B"
              >
                0
              </text>
            </g>

            {/* Parabola Curve */}
            {visibleCurvePath && (
              <path
                d={visibleCurvePath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Axis of Symmetry: x = 2 */}
            {axisSymOpacity > 0 && (
              <g opacity={axisSymOpacity}>
                <line
                  x1={toSvgX(2)}
                  y1={820 - axisSymLength}
                  x2={toSvgX(2)}
                  y2={820}
                  stroke="#7C3AED"
                  strokeWidth="5"
                  strokeDasharray="10 8"
                />
                <text
                  x={toSvgX(2) + 12}
                  y={140}
                  fontSize="44"
                  fontWeight="800"
                  fill="#7C3AED"
                >
                  x = 2
                </text>
              </g>
            )}

            {/* Vertex Point at (2, -1) */}
            {vertexOpacity > 0 && (
              <g
                opacity={vertexOpacity}
                transform={`translate(${toSvgX(2)}, ${toSvgY(-1)})`}
              >
                <circle
                  r={16 * Math.max(0, vertexSpring)}
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth="4"
                />
                <text
                  x="20"
                  y="40"
                  fontSize="44"
                  fontWeight="800"
                  fill="#DC2626"
                >
                  (2, −1)
                </text>
              </g>
            )}

            {/* Roots at x = 1 and x = 3 */}
            {rootsOpacity > 0 && (
              <g opacity={rootsOpacity}>
                {/* Root 1: (1, 0) */}
                <g transform={`translate(${toSvgX(1)}, ${toSvgY(0)})`}>
                  <circle
                    r={16 * Math.max(0, rootsSpring)}
                    fill="#059669"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                  />
                  <text
                    x="-65"
                    y="-22"
                    fontSize="44"
                    fontWeight="800"
                    fill="#059669"
                  >
                    x = 1
                  </text>
                </g>

                {/* Root 2: (3, 0) */}
                <g transform={`translate(${toSvgX(3)}, ${toSvgY(0)})`}>
                  <circle
                    r={16 * Math.max(0, rootsSpring)}
                    fill="#059669"
                    stroke="#FFFFFF"
                    strokeWidth="4"
                  />
                  <text
                    x="15"
                    y="-22"
                    fontSize="44"
                    fontWeight="800"
                    fill="#059669"
                  >
                    x = 3
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Right Side: Step-by-Step Educational Cards */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            justifyContent: "space-between",
            height: "860px",
          }}
        >
          {/* Card 1: Roots */}
          <div
            style={{
              padding: "24px 32px",
              borderRadius: "20px",
              backgroundColor: rootsOpacity > 0 ? "#F0FDF4" : "#F8FAFC",
              border: `4px solid ${rootsOpacity > 0 ? "#059669" : "#E2E8F0"}`,
              opacity: rootsOpacity > 0 ? 1 : 0.4,
              transition: "all 0.3s ease",
            }}
          >
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                color: rootsOpacity > 0 ? "#059669" : "#64748B",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: rootsOpacity > 0 ? "#059669" : "#94A3B8",
                }}
              />
              1. Roots (x-intercepts)
            </div>
            <div
              style={{
                fontSize: "44px",
                color: "#1E293B",
                fontWeight: 600,
                marginTop: "8px",
              }}
            >
              Where y = 0 :{" "}
              <span style={{ color: "#059669", fontWeight: 800 }}>
                x = 1, x = 3
              </span>
            </div>
          </div>

          {/* Card 2: Vertex */}
          <div
            style={{
              padding: "24px 32px",
              borderRadius: "20px",
              backgroundColor: vertexOpacity > 0 ? "#FEF2F2" : "#F8FAFC",
              border: `4px solid ${vertexOpacity > 0 ? "#DC2626" : "#E2E8F0"}`,
              opacity: vertexOpacity > 0 ? 1 : 0.4,
            }}
          >
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                color: vertexOpacity > 0 ? "#DC2626" : "#64748B",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: vertexOpacity > 0 ? "#DC2626" : "#94A3B8",
                }}
              />
              2. Vertex (Turning Point)
            </div>
            <div
              style={{
                fontSize: "44px",
                color: "#1E293B",
                fontWeight: 600,
                marginTop: "8px",
              }}
            >
              Lowest point:{" "}
              <span style={{ color: "#DC2626", fontWeight: 800 }}>
                (2, −1)
              </span>
            </div>
          </div>

          {/* Card 3: Axis of Symmetry */}
          <div
            style={{
              padding: "24px 32px",
              borderRadius: "20px",
              backgroundColor: axisSymOpacity > 0 ? "#FAF5FF" : "#F8FAFC",
              border: `4px solid ${axisSymOpacity > 0 ? "#7C3AED" : "#E2E8F0"}`,
              opacity: axisSymOpacity > 0 ? 1 : 0.4,
            }}
          >
            <div
              style={{
                fontSize: "44px",
                fontWeight: 800,
                color: axisSymOpacity > 0 ? "#7C3AED" : "#64748B",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: axisSymOpacity > 0 ? "#7C3AED" : "#94A3B8",
                }}
              />
              3. Axis of Symmetry
            </div>
            <div
              style={{
                fontSize: "44px",
                color: "#1E293B",
                fontWeight: 600,
                marginTop: "8px",
              }}
            >
              Vertical mirror:{" "}
              <span style={{ color: "#7C3AED", fontWeight: 800 }}>
                x = 2
              </span>
            </div>
          </div>

          {/* Final Summary Box */}
          <div
            style={{
              padding: "26px 34px",
              borderRadius: "24px",
              backgroundColor: "#0F172A",
              border: "4px solid #334155",
              boxShadow: summaryHighlight > 0
                ? "0 20px 40px rgba(15, 23, 42, 0.25)"
                : "none",
              transform: `scale(${1 + summaryHighlight * 0.02})`,
              transition: "transform 0.3s ease",
            }}
          >
            <div
              style={{
                fontSize: "44px",
                fontWeight: 900,
                color: "#38BDF8",
                marginBottom: "12px",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
              }}
            >
              Key Features Summary
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "44px",
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              <div>
                • Roots: <span style={{ color: "#34D399" }}>x = 1, x = 3</span>
              </div>
              <div>
                • Vertex: <span style={{ color: "#F87171" }}>(2, −1)</span>
              </div>
              <div>
                • Axis of Symmetry:{" "}
                <span style={{ color: "#C084FC" }}>x = 2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};