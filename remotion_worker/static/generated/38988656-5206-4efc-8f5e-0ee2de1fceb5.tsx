import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  Easing,
  spring,
} from "remotion";

export const DURATION_SECONDS = 40;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Coordinate system mapping:
  // Math x: [-1.2, 5.2], Math y: [-2.2, 5.2]
  // SVG viewBox: 0 0 960 840
  const svgX = (x: number) => 180 + x * 135;
  const svgY = (y: number) => 580 - y * 95;

  // Grid tick values
  const xTicks = [-1, 1, 2, 3, 4, 5];
  const yTicks = [-2, -1, 1, 2, 3, 4, 5];

  // Parabola points calculation: y = x^2 - 4x + 3
  const curvePoints = useMemo(() => {
    const pts: { x: number; y: number; sx: number; sy: number }[] = [];
    const minX = -0.35;
    const maxX = 4.35;
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const cx = minX + (i / steps) * (maxX - minX);
      const cy = cx * cx - 4 * cx + 3;
      pts.push({ x: cx, y: cy, sx: svgX(cx), sy: svgY(cy) });
    }
    return pts;
  }, []);

  // Animation Progress interpolations
  // 1. Grid & Axes entrance: 0 - 50 frames
  const gridOpacity = interpolate(frame, [5, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2. Parabola curve drawing: 70 - 180 frames
  const curveProgress = interpolate(frame, [70, 180], [0, 1], {
    easing: Easing.bezier(0.4, 0, 0.2, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const activePointsCount = Math.max(
    2,
    Math.floor(curveProgress * curvePoints.length)
  );
  const activePath = useMemo(() => {
    const pts = curvePoints.slice(0, activePointsCount);
    return pts
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`)
      .join(" ");
  }, [activePointsCount, curvePoints]);

  // 3. Roots reveal: 200 - 340 frames
  const rootsSpring = spring({
    frame: frame - 200,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const rootsVisible = frame >= 200;

  // 4. Vertex reveal: 340 - 480 frames
  const vertexSpring = spring({
    frame: frame - 340,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const vertexVisible = frame >= 340;

  // 5. Axis of symmetry: 480 - 620 frames
  const axisProgress = interpolate(frame, [480, 560], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const axisSpring = spring({
    frame: frame - 500,
    fps,
    config: { damping: 14, stiffness: 120 },
  });
  const axisVisible = frame >= 480;

  // 6. Summary highlight: 620+ frames
  const summarySpring = spring({
    frame: frame - 620,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  const summaryGlow = frame >= 620 ? Math.sin((frame - 620) * 0.15) * 4 + 4 : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#0f172a",
        padding: 0,
        margin: 0,
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 60,
          right: 60,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          borderBottom: "5px solid #e2e8f0",
          paddingBottom: 15,
        }}
      >
        <h1
          style={{
            fontSize: 90,
            fontWeight: 900,
            margin: 0,
            letterSpacing: "-2px",
            color: "#0f172a",
          }}
        >
          Quadratic Graph
        </h1>
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#2563eb",
            backgroundColor: "#eff6ff",
            padding: "8px 24px",
            borderRadius: 16,
            border: "5px solid #bfdbfe",
          }}
        >
          y = x² − 4x + 3
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 60,
          right: 60,
          bottom: 30,
          display: "flex",
          gap: 40,
        }}
      >
        {/* Left Side: Graph SVG */}
        <div
          style={{
            width: 980,
            height: 850,
            backgroundColor: "#f8fafc",
            borderRadius: 24,
            border: "5px solid #cbd5e1",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
          }}
        >
          <svg
            width="980"
            height="850"
            viewBox="0 0 980 850"
            style={{ opacity: gridOpacity }}
          >
            {/* Background Grid Lines */}
            {xTicks.map((xt) => (
              <line
                key={`gx-${xt}`}
                x1={svgX(xt)}
                y1={30}
                x2={svgX(xt)}
                y2={800}
                stroke="#e2e8f0"
                strokeWidth={4}
              />
            ))}
            {yTicks.map((yt) => (
              <line
                key={`gy-${yt}`}
                x1={40}
                y1={svgY(yt)}
                x2={940}
                y2={svgY(yt)}
                stroke="#e2e8f0"
                strokeWidth={4}
              />
            ))}

            {/* X-Axis */}
            <line
              x1={40}
              y1={svgY(0)}
              x2={940}
              y2={svgY(0)}
              stroke="#334155"
              strokeWidth={6}
            />
            {/* Y-Axis */}
            <line
              x1={svgX(0)}
              y1={810}
              x2={svgX(0)}
              y2={40}
              stroke="#334155"
              strokeWidth={6}
            />

            {/* Axis Arrows */}
            <polygon
              points={`${svgX(0)},25 ${svgX(0) - 12},45 ${svgX(0) + 12},45`}
              fill="#334155"
            />
            <polygon
              points={`955,${svgY(0)} 935,${svgY(0) - 12} 935,${svgY(0) + 12}`}
              fill="#334155"
            />

            {/* Axis Names */}
            <text
              x={svgX(0) + 20}
              y={55}
              fill="#0f172a"
              fontSize={46}
              fontWeight={800}
            >
              y
            </text>
            <text
              x={925}
              y={svgY(0) + 55}
              fill="#0f172a"
              fontSize={46}
              fontWeight={800}
            >
              x
            </text>

            {/* Origin (0,0) */}
            <text
              x={svgX(0) - 35}
              y={svgY(0) + 42}
              fill="#64748b"
              fontSize={40}
              fontWeight={700}
            >
              0
            </text>

            {/* X Ticks & Labels */}
            {xTicks.map((xt) => (
              <g key={`xt-${xt}`}>
                <line
                  x1={svgX(xt)}
                  y1={svgY(0) - 8}
                  x2={svgX(xt)}
                  y2={svgY(0) + 8}
                  stroke="#334155"
                  strokeWidth={5}
                />
                <text
                  x={svgX(xt)}
                  y={svgY(0) + 45}
                  fill="#475569"
                  fontSize={42}
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {xt}
                </text>
              </g>
            ))}

            {/* Y Ticks & Labels */}
            {yTicks.map((yt) => (
              <g key={`yt-${yt}`}>
                <line
                  x1={svgX(0) - 8}
                  y1={svgY(yt)}
                  x2={svgX(0) + 8}
                  y2={svgY(yt)}
                  stroke="#334155"
                  strokeWidth={5}
                />
                <text
                  x={svgX(0) - 22}
                  y={svgY(yt) + 14}
                  fill="#475569"
                  fontSize={42}
                  fontWeight={700}
                  textAnchor="end"
                >
                  {yt}
                </text>
              </g>
            ))}

            {/* Axis of Symmetry Dashed Line */}
            {axisVisible && (
              <g>
                <line
                  x1={svgX(2)}
                  y1={svgY(5.2)}
                  x2={svgX(2)}
                  y2={svgY(5.2) + axisProgress * (svgY(-2) - svgY(5.2))}
                  stroke="#7c3aed"
                  strokeWidth={6}
                  strokeDasharray="14 10"
                />
                <text
                  x={svgX(2) + 15}
                  y={svgY(4.5)}
                  fill="#7c3aed"
                  fontSize={44}
                  fontWeight={800}
                  style={{
                    opacity: Math.min(1, axisSpring),
                  }}
                >
                  x = 2
                </text>
              </g>
            )}

            {/* The Quadratic Parabola Curve */}
            {activePointsCount > 1 && (
              <path
                d={activePath}
                fill="none"
                stroke="#2563eb"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Roots Markers and Labels */}
            {rootsVisible && (
              <g style={{ transform: `scale(${rootsSpring})`, transformOrigin: `${svgX(2)}px ${svgY(0)}px` }}>
                {/* Root 1: x = 1 */}
                <circle
                  cx={svgX(1)}
                  cy={svgY(0)}
                  r={16}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth={5}
                />
                <circle
                  cx={svgX(1)}
                  cy={svgY(0)}
                  r={24}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={4}
                  opacity={0.5}
                />
                <text
                  x={svgX(1) - 20}
                  y={svgY(0) - 30}
                  fill="#059669"
                  fontSize={46}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  (1, 0)
                </text>

                {/* Root 2: x = 3 */}
                <circle
                  cx={svgX(3)}
                  cy={svgY(0)}
                  r={16}
                  fill="#059669"
                  stroke="#ffffff"
                  strokeWidth={5}
                />
                <circle
                  cx={svgX(3)}
                  cy={svgY(0)}
                  r={24}
                  fill="none"
                  stroke="#059669"
                  strokeWidth={4}
                  opacity={0.5}
                />
                <text
                  x={svgX(3) + 20}
                  y={svgY(0) - 30}
                  fill="#059669"
                  fontSize={46}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  (3, 0)
                </text>
              </g>
            )}

            {/* Vertex Marker and Label */}
            {vertexVisible && (
              <g
                style={{
                  transform: `scale(${vertexSpring})`,
                  transformOrigin: `${svgX(2)}px ${svgY(-1)}px`,
                }}
              >
                <circle
                  cx={svgX(2)}
                  cy={svgY(-1)}
                  r={18}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={5}
                />
                <circle
                  cx={svgX(2)}
                  cy={svgY(-1)}
                  r={28}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth={4}
                  opacity={0.5}
                />
                <text
                  x={svgX(2)}
                  y={svgY(-1) + 65}
                  fill="#dc2626"
                  fontSize={48}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  Vertex (2, −1)
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Right Side: Step Explanations & Summary Cards */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            justifyContent: "space-between",
          }}
        >
          {/* Card 1: Roots */}
          <div
            style={{
              backgroundColor: "#f0fdf4",
              border: "5px solid #059669",
              borderRadius: 20,
              padding: "20px 28px",
              opacity: rootsVisible ? Math.min(1, rootsSpring) : 0.2,
              transform: `translateX(${rootsVisible ? 0 : 30}px)`,
              boxShadow: rootsVisible
                ? "0 10px 20px -5px rgba(5, 150, 105, 0.2)"
                : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#059669",
                }}
              />
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: "#059669",
                }}
              >
                Roots (x-intercepts)
              </span>
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#166534",
                marginLeft: 44,
              }}
            >
              x = 1 &nbsp;and&nbsp; x = 3
            </div>
            <div
              style={{
                fontSize: 42,
                color: "#4b5563",
                marginLeft: 44,
                marginTop: 4,
              }}
            >
              Points where y = 0
            </div>
          </div>

          {/* Card 2: Vertex */}
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "5px solid #dc2626",
              borderRadius: 20,
              padding: "20px 28px",
              opacity: vertexVisible ? Math.min(1, vertexSpring) : 0.2,
              transform: `translateX(${vertexVisible ? 0 : 30}px)`,
              boxShadow: vertexVisible
                ? "0 10px 20px -5px rgba(220, 38, 38, 0.2)"
                : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#dc2626",
                }}
              />
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: "#dc2626",
                }}
              >
                Vertex (Turning Point)
              </span>
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#991b1b",
                marginLeft: 44,
              }}
            >
              (2, −1) &nbsp;[Minimum]
            </div>
            <div
              style={{
                fontSize: 42,
                color: "#4b5563",
                marginLeft: 44,
                marginTop: 4,
              }}
            >
              Lowest point on parabola
            </div>
          </div>

          {/* Card 3: Axis of Symmetry */}
          <div
            style={{
              backgroundColor: "#f5f3ff",
              border: "5px solid #7c3aed",
              borderRadius: 20,
              padding: "20px 28px",
              opacity: axisVisible ? Math.min(1, axisSpring) : 0.2,
              transform: `translateX(${axisVisible ? 0 : 30}px)`,
              boxShadow: axisVisible
                ? "0 10px 20px -5px rgba(124, 58, 237, 0.2)"
                : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#7c3aed",
                }}
              />
              <span
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  color: "#7c3aed",
                }}
              >
                Axis of Symmetry
              </span>
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#5b21b6",
                marginLeft: 44,
              }}
            >
              Line &nbsp;x = 2
            </div>
            <div
              style={{
                fontSize: 42,
                color: "#4b5563",
                marginLeft: 44,
                marginTop: 4,
              }}
            >
              Passes through the vertex
            </div>
          </div>

          {/* Final Summary Card */}
          <div
            style={{
              backgroundColor: "#0f172a",
              borderRadius: 20,
              padding: "22px 28px",
              color: "#ffffff",
              opacity: Math.min(1, summarySpring),
              transform: `scale(${0.95 + 0.05 * Math.min(1, summarySpring)})`,
              border: `${5 + summaryGlow}px solid #3b82f6`,
              boxShadow: "0 15px 30px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: "#93c5fd",
                marginBottom: 10,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Key Takeaway
            </div>
            <div
              style={{
                fontSize: 42,
                fontWeight: 600,
                lineHeight: 1.35,
                color: "#f8fafc",
              }}
            >
              A quadratic graph y = ax² + bx + c gives{" "}
              <span style={{ color: "#34d399", fontWeight: 800 }}>roots</span> at y=0, a{" "}
              <span style={{ color: "#f87171", fontWeight: 800 }}>vertex</span> at peak/trough, and mirrors across its{" "}
              <span style={{ color: "#c084fc", fontWeight: 800 }}>axis</span>.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};