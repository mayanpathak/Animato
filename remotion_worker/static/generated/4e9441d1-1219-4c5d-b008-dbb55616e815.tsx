import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const DURATION_SECONDS = 40;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Coordinate system configuration
  const originX = 520;
  const originY = 720;
  const unit = 95; // 95 pixels per math unit

  const toSvgX = (x: number) => originX + x * unit;
  const toSvgY = (y: number) => originY - y * unit;

  // Function: y = x^2 - 4x + 3
  const f = (x: number) => x * x - 4 * x + 3;

  // Animations & Timings
  // 1. Grid & Axes enter (frames 0 - 30)
  const gridOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 2. Parabola curve drawing (frames 35 - 130)
  const curveProgress = interpolate(frame, [35, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  // 3. Vertex highlight (frames 150 - 240)
  const vertexSpring = spring({
    frame: frame - 150,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const showVertex = frame >= 150;

  // 4. Axis of symmetry line (frames 250 - 350)
  const axisProgress = interpolate(frame, [250, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const showAxis = frame >= 250;

  // 5. Roots highlight (frames 370 - 470)
  const rootsSpring = spring({
    frame: frame - 370,
    fps,
    config: { damping: 12, stiffness: 120 },
  });
  const showRoots = frame >= 370;

  // 6. Summary Box appear (frames 500 - 800)
  const summarySpring = spring({
    frame: frame - 500,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const showSummary = frame >= 500;

  // Generate parabola SVG path up to current progress
  const parabolaPath = useMemo(() => {
    if (curveProgress <= 0) return "";
    const minX = -0.6;
    const maxX = 4.6;
    const currentMaxX = minX + curveProgress * (maxX - minX);
    const steps = 120;
    const pathSegments: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = minX + (i / steps) * (currentMaxX - minX);
      const y = f(x);
      const sx = toSvgX(x);
      const sy = toSvgY(y);
      if (i === 0) {
        pathSegments.push(`M ${sx.toFixed(1)} ${sy.toFixed(1)}`);
      } else {
        pathSegments.push(`L ${sx.toFixed(1)} ${sy.toFixed(1)}`);
      }
    }
    return pathSegments.join(" ");
  }, [curveProgress]);

  // Grid coordinates
  const xTicks = [-1, 1, 2, 3, 4, 5];
  const yTicks = [-2, -1, 1, 2, 3, 4, 5, 6];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F8FAFC",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "3px solid #E2E8F0",
          paddingBottom: 20,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#3B82F6",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Class 10 Mathematics • Quadratic Graphs
          </span>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: "#0F172A",
              margin: "4px 0 0 0",
              lineHeight: 1.1,
            }}
          >
            Graphing{" "}
            <span style={{ color: "#2563EB" }}>y = x² − 4x + 3</span>
          </h1>
        </div>

        <div
          style={{
            backgroundColor: "#EFF6FF",
            border: "2px solid #BFDBFE",
            borderRadius: 16,
            padding: "12px 28px",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: 20, color: "#1E40AF", fontWeight: 700 }}>
            Standard Form: y = ax² + bx + c
          </div>
          <div style={{ fontSize: 22, color: "#1D4ED8", fontWeight: 800 }}>
            a = 1, b = −4, c = 3
          </div>
        </div>
      </div>

      {/* Main Graph Area (SVG) */}
      <svg
        width={1060}
        height={850}
        style={{
          position: "absolute",
          top: 170,
          left: 40,
          opacity: gridOpacity,
        }}
      >
        <defs>
          <marker
            id="arrow-x"
            markerWidth="10"
            markerHeight="10"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
          </marker>
          <marker
            id="arrow-y"
            markerWidth="10"
            markerHeight="10"
            refX="3"
            refY="3"
            orient="auto"
          >
            <path d="M0,6 L6,6 L3,0 z" fill="#475569" />
          </marker>
        </defs>

        {/* Grid lines (horizontal & vertical) */}
        {[-1, 0, 1, 2, 3, 4, 5].map((xVal) => (
          <line
            key={`grid-x-${xVal}`}
            x1={toSvgX(xVal)}
            y1={toSvgY(6.3)}
            x2={toSvgX(xVal)}
            y2={toSvgY(-2.3)}
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />
        ))}
        {[-2, -1, 0, 1, 2, 3, 4, 5, 6].map((yVal) => (
          <line
            key={`grid-y-${yVal}`}
            x1={toSvgX(-1.3)}
            y1={toSvgY(yVal)}
            x2={toSvgX(5.4)}
            y2={toSvgY(yVal)}
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />
        ))}

        {/* Main Axes */}
        {/* X-axis */}
        <line
          x1={toSvgX(-1.3)}
          y1={originY}
          x2={toSvgX(5.4)}
          y2={originY}
          stroke="#334155"
          strokeWidth="3.5"
          markerEnd="url(#arrow-x)"
        />
        {/* Y-axis */}
        <line
          x1={originX}
          y1={toSvgY(-2.3)}
          x2={originX}
          y2={toSvgY(6.4)}
          stroke="#334155"
          strokeWidth="3.5"
          markerEnd="url(#arrow-y)"
        />

        {/* Axis Labels */}
        <text
          x={toSvgX(5.4) + 12}
          y={originY + 10}
          fontSize="32"
          fontWeight="bold"
          fill="#334155"
        >
          x
        </text>
        <text
          x={originX - 10}
          y={toSvgY(6.4) - 14}
          fontSize="32"
          fontWeight="bold"
          fill="#334155"
          textAnchor="middle"
        >
          y
        </text>
        <text
          x={originX - 22}
          y={originY + 28}
          fontSize="24"
          fill="#64748B"
          fontWeight="600"
        >
          0
        </text>

        {/* Ticks and tick numbers on X-axis */}
        {xTicks.map((xVal) => (
          <g key={`tick-x-${xVal}`}>
            <line
              x1={toSvgX(xVal)}
              y1={originY - 6}
              x2={toSvgX(xVal)}
              y2={originY + 6}
              stroke="#334155"
              strokeWidth="2.5"
            />
            <text
              x={toSvgX(xVal)}
              y={originY + 32}
              fontSize="24"
              fill="#475569"
              textAnchor="middle"
              fontWeight="600"
            >
              {xVal}
            </text>
          </g>
        ))}

        {/* Ticks and tick numbers on Y-axis */}
        {yTicks.map((yVal) => (
          <g key={`tick-y-${yVal}`}>
            <line
              x1={originX - 6}
              y1={toSvgY(yVal)}
              x2={originX + 6}
              y2={toSvgY(yVal)}
              stroke="#334155"
              strokeWidth="2.5"
            />
            <text
              x={originX - 20}
              y={toSvgY(yVal) + 8}
              fontSize="24"
              fill="#475569"
              textAnchor="end"
              fontWeight="600"
            >
              {yVal}
            </text>
          </g>
        ))}

        {/* Axis of Symmetry: x = 2 (Dashed line) */}
        {showAxis && (
          <g>
            <line
              x1={toSvgX(2)}
              y1={toSvgY(-2.2)}
              x2={toSvgX(2)}
              y2={toSvgY(-2.2 + axisProgress * 8.4)}
              stroke="#D97706"
              strokeWidth="4"
              strokeDasharray="10 8"
            />
            {axisProgress > 0.8 && (
              <text
                x={toSvgX(2) + 12}
                y={toSvgY(5.5)}
                fontSize="26"
                fontWeight="800"
                fill="#D97706"
              >
                x = 2
              </text>
            )}
          </g>
        )}

        {/* Parabola Curve */}
        {parabolaPath && (
          <path
            d={parabolaPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}

        {/* Vertex Marker & Label */}
        {showVertex && (
          <g style={{ transform: `scale(${Math.max(0, vertexSpring)})`, transformOrigin: `${toSvgX(2)}px ${toSvgY(-1)}px` }}>
            <circle
              cx={toSvgX(2)}
              cy={toSvgY(-1)}
              r="14"
              fill="#7C3AED"
              stroke="#FFFFFF"
              strokeWidth="3.5"
            />
            <circle
              cx={toSvgX(2)}
              cy={toSvgY(-1)}
              r="22"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="2.5"
              opacity="0.4"
            />
            {/* Background pill for vertex text */}
            <rect
              x={toSvgX(2) - 95}
              y={toSvgY(-1) + 18}
              width="190"
              height="44"
              rx="10"
              fill="#7C3AED"
            />
            <text
              x={toSvgX(2)}
              y={toSvgY(-1) + 48}
              fontSize="24"
              fontWeight="800"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              Vertex (2, −1)
            </text>
          </g>
        )}

        {/* Roots Markers & Labels */}
        {showRoots && (
          <g style={{ transform: `scale(${Math.max(0, rootsSpring)})`, transformOrigin: `${toSvgX(2)}px ${toSvgY(0)}px` }}>
            {/* Root at x = 1 */}
            <circle
              cx={toSvgX(1)}
              cy={toSvgY(0)}
              r="12"
              fill="#059669"
              stroke="#FFFFFF"
              strokeWidth="3.5"
            />
            <rect
              x={toSvgX(1) - 80}
              y={toSvgY(0) - 56}
              width="100"
              height="38"
              rx="8"
              fill="#059669"
            />
            <text
              x={toSvgX(1) - 30}
              y={toSvgY(0) - 31}
              fontSize="22"
              fontWeight="800"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              (1, 0)
            </text>

            {/* Root at x = 3 */}
            <circle
              cx={toSvgX(3)}
              cy={toSvgY(0)}
              r="12"
              fill="#059669"
              stroke="#FFFFFF"
              strokeWidth="3.5"
            />
            <rect
              x={toSvgX(3) - 20}
              y={toSvgY(0) - 56}
              width="100"
              height="38"
              rx="8"
              fill="#059669"
            />
            <text
              x={toSvgX(3) + 30}
              y={toSvgY(0) - 31}
              fontSize="22"
              fontWeight="800"
              fill="#FFFFFF"
              textAnchor="middle"
            >
              (3, 0)
            </text>
          </g>
        )}
      </svg>

      {/* Right Explanation & Summary Panel */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 1130,
          width: 730,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Step 1: Curve appearance card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: "20px 28px",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
            borderLeft: "8px solid #2563EB",
            opacity: interpolate(frame, [35, 60], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateX(${interpolate(frame, [35, 60], [40, 0], {
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 800, color: "#2563EB", marginBottom: 6 }}>
            1. U-SHAPED PARABOLA
          </div>
          <div style={{ fontSize: 28, color: "#1E293B", fontWeight: 600, lineHeight: 1.4 }}>
            Since <span style={{ fontWeight: 800, color: "#2563EB" }}>a = 1 &gt; 0</span>,
            the parabola opens upward with a minimum value.
          </div>
        </div>

        {/* Step 2: Vertex card */}
        {showVertex && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: "20px 28px",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
              borderLeft: "8px solid #7C3AED",
              opacity: Math.min(1, vertexSpring),
              transform: `translateX(${(1 - Math.min(1, vertexSpring)) * 40}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#7C3AED", marginBottom: 6 }}>
              2. VERTEX (Turning Point)
            </div>
            <div style={{ fontSize: 28, color: "#1E293B", fontWeight: 600 }}>
              x = −b / (2a) = 4 / 2 = <strong>2</strong>
            </div>
            <div style={{ fontSize: 28, color: "#475569", marginTop: 4 }}>
              y = (2)² − 4(2) + 3 = <strong>−1</strong> → Minimum at{" "}
              <span style={{ color: "#7C3AED", fontWeight: 800 }}>(2, −1)</span>
            </div>
          </div>
        )}

        {/* Step 3: Axis of symmetry card */}
        {showAxis && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: "20px 28px",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
              borderLeft: "8px solid #D97706",
              opacity: Math.min(1, axisProgress * 1.5),
              transform: `translateX(${(1 - Math.min(1, axisProgress)) * 40}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#D97706", marginBottom: 6 }}>
              3. AXIS OF SYMMETRY
            </div>
            <div style={{ fontSize: 28, color: "#1E293B", fontWeight: 600 }}>
              Vertical line passing through the vertex:{" "}
              <span style={{ color: "#D97706", fontWeight: 800 }}>x = 2</span>
            </div>
          </div>
        )}

        {/* Step 4: Roots / Intercepts card */}
        {showRoots && (
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: "20px 28px",
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
              borderLeft: "8px solid #059669",
              opacity: Math.min(1, rootsSpring),
              transform: `translateX(${(1 - Math.min(1, rootsSpring)) * 40}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#059669", marginBottom: 6 }}>
              4. ROOTS (x-Intercepts)
            </div>
            <div style={{ fontSize: 28, color: "#1E293B", fontWeight: 600 }}>
              Set y = 0: (x − 1)(x − 3) = 0
            </div>
            <div style={{ fontSize: 28, color: "#059669", fontWeight: 800, marginTop: 4 }}>
              Roots at x = 1 and x = 3
            </div>
          </div>
        )}

        {/* Final Comprehensive Summary Box (frame 500+) */}
        {showSummary && (
          <div
            style={{
              backgroundColor: "#0F172A",
              borderRadius: 20,
              padding: "26px 32px",
              color: "#FFFFFF",
              boxShadow: "0 20px 40px rgba(15, 23, 42, 0.25)",
              transform: `scale(${Math.min(1, summarySpring)})`,
              transformOrigin: "center top",
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "#FBBF24",
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              SUMMARY • KEY FEATURES
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 600 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: "#059669",
                    marginRight: 16,
                  }}
                />
                <span style={{ color: "#94A3B8", width: 240 }}>Roots (y = 0):</span>
                <span style={{ color: "#34D399", fontWeight: 800 }}>x = 1, x = 3</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 600 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: "#7C3AED",
                    marginRight: 16,
                  }}
                />
                <span style={{ color: "#94A3B8", width: 240 }}>Vertex (Min):</span>
                <span style={{ color: "#C084FC", fontWeight: 800 }}>(2, −1)</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", fontSize: 28, fontWeight: 600 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    backgroundColor: "#D97706",
                    marginRight: 16,
                  }}
                />
                <span style={{ color: "#94A3B8", width: 240 }}>Axis of Symmetry:</span>
                <span style={{ color: "#FBBF24", fontWeight: 800 }}>x = 2</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};