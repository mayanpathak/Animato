import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  Easing,
  spring,
  Series,
} from "remotion";
import React from "react";

export const DURATION_SECONDS = 45;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const DURATION_FRAMES = DURATION_SECONDS * fps;

  // --- Configuration ---
  const bgColor = "#1a202c"; // Dark blue background
  const textColor = "white";
  const labelColor = "#cbd5e0"; // Light grey for labels
  const sideAColor = "#ef4444"; // Red
  const sideBColor = "#3b82f6"; // Blue
  const sideCColor = "#22c55e"; // Green

  const baseFontSize = 44;
  const titleFontSize = 100;
  const labelFontSize = 54;
  const equationFontSize = 80;

  // --- Common Animations ---
  const fadeIn = (currentFrame: number, startFrame: number, endFrame: number) =>
    interpolate(currentFrame, [startFrame, endFrame], [0, 1], {
      extrapolateRight: "clamp",
    });

  const fadeOut = (currentFrame: number, startFrame: number, endFrame: number) =>
    interpolate(currentFrame, [startFrame, endFrame], [1, 0], {
      extrapolateLeft: "clamp",
    });

  const scaleIn = (currentFrame: number, startFrame: number, endFrame: number) =>
    spring({
      frame: currentFrame - startFrame,
      fps,
      config: { damping: 200, stiffness: 200, mass: 1 },
      durationInFrames: endFrame - startFrame,
    });

  // --- Triangle Geometry (scaled up for visibility) ---
  const scaleUnit = 100; // 1 unit = 100 pixels
  const sideA = 3 * scaleUnit; // 300px
  const sideB = 4 * scaleUnit; // 400px
  const sideC = 5 * scaleUnit; // 500px (hypotenuse)

  // Position the right angle near the center of the screen
  const centerX = 1920 / 2;
  const centerY = 1080 / 2;

  // Right angle vertex coordinates
  const rightAngleX = centerX - sideB / 2;
  const rightAngleY = centerY + sideA / 2;

  // Other vertices
  const topVertexX = rightAngleX;
  const topVertexY = rightAngleY - sideA;
  const rightVertexX = rightAngleX + sideB;
  const rightVertexY = rightAngleY;

  // Hypotenuse angle for rotation
  const angleC = (Math.atan2(sideA, sideB) * 180) / Math.PI; // In degrees
  const angleCSquareRotation = -angleC;

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor }}>
      {/* Scene 1: Title Card */}
      <Sequence from={0} durationInFrames={fps * 5}>
        {(frame) => {
          const opacity = interpolate(
            frame,
            [0, fps, fps * 4, fps * 5],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );
          const titleScale = scaleIn(frame, 0, fps);

          return (
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                opacity,
              }}
            >
              <h1
                style={{
                  fontSize: titleFontSize,
                  color: textColor,
                  fontFamily: "sans-serif",
                  transform: `scale(${titleScale})`,
                  fontWeight: "bold",
                  textAlign: "center",
                  padding: "0 50px",
                }}
              >
                The Pythagorean Theorem
              </h1>
            </AbsoluteFill>
          );
        }}
      </Sequence>

      {/* Scene 2: Draw Right Triangle & Labels */}
      <Sequence from={fps * 4} durationInFrames={fps * 11}>
        {(frame) => {
          const mainOpacity = fadeIn(frame, 0, fps);

          // Triangle lines drawing animation
          const lineProgressA = interpolate(frame, [10, 40], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineProgressB = interpolate(frame, [30, 60], [0, 1], {
            extrapolateRight: "clamp",
          });
          const lineProgressC = interpolate(frame, [50, 80], [0, 1], {
            extrapolateRight: "clamp",
          });

          // Side labels fade in
          const labelOpacityA = fadeIn(frame, 100, 120);
          const labelOpacityB = fadeIn(frame, 110, 130);
          const labelOpacityC = fadeIn(frame, 120, 140);

          // Length labels fade in
          const lengthOpacityA = fadeIn(frame, 150, 170);
          const lengthOpacityB = fadeIn(frame, 160, 180);
          const lengthOpacityC = fadeIn(frame, 170, 190);

          return (
            <AbsoluteFill style={{ opacity: mainOpacity }}>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 1920 1080`}
                style={{ position: "absolute" }}
              >
                {/* Side A (vertical) */}
                <line
                  x1={topVertexX}
                  y1={topVertexY}
                  x2={rightAngleX}
                  y2={rightAngleY}
                  stroke={sideAColor}
                  strokeWidth="8"
                  strokeDasharray={sideA}
                  strokeDashoffset={sideA * (1 - lineProgressA)}
                />
                {/* Side B (horizontal) */}
                <line
                  x1={rightAngleX}
                  y1={rightAngleY}
                  x2={rightVertexX}
                  y2={rightVertexY}
                  stroke={sideBColor}
                  strokeWidth="8"
                  strokeDasharray={sideB}
                  strokeDashoffset={sideB * (1 - lineProgressB)}
                />
                {/* Side C (hypotenuse) */}
                <line
                  x1={topVertexX}
                  y1={topVertexY}
                  x2={rightVertexX}
                  y2={rightVertexY}
                  stroke={sideCColor}
                  strokeWidth="8"
                  strokeDasharray={sideC}
                  strokeDashoffset={sideC * (1 - lineProgressC)}
                />

                {/* Right angle symbol */}
                <path
                  d={`M${rightAngleX + 20},${rightAngleY} L${rightAngleX + 20},${rightAngleY - 20} L${rightAngleX},${rightAngleY - 20}`}
                  stroke={labelColor}
                  strokeWidth="4"
                  fill="none"
                  opacity={fadeIn(frame, 80, 100)}
                />

                {/* Labels a, b, c */}
                <text
                  x={topVertexX - 40}
                  y={topVertexY + sideA / 2 + 15}
                  fontSize={labelFontSize}
                  fill={sideAColor}
                  fontFamily="sans-serif"
                  textAnchor="end"
                  opacity={labelOpacityA}
                >
                  a
                </text>
                <text
                  x={rightAngleX + sideB / 2}
                  y={rightAngleY + 60}
                  fontSize={labelFontSize}
                  fill={sideBColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={labelOpacityB}
                >
                  b
                </text>
                <text
                  x={rightAngleX + sideB / 2 + 20}
                  y={topVertexY + sideA / 2 - 20}
                  fontSize={labelFontSize}
                  fill={sideCColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={labelOpacityC}
                  transform={`rotate(${angleCSquareRotation}, ${rightAngleX + sideB / 2}, ${topVertexY + sideA / 2})`}
                >
                  c
                </text>

                {/* Lengths 3, 4, 5 */}
                <text
                  x={topVertexX - 40}
                  y={topVertexY + sideA / 2 - 25}
                  fontSize={baseFontSize}
                  fill={textColor}
                  fontFamily="sans-serif"
                  textAnchor="end"
                  opacity={lengthOpacityA}
                >
                  3
                </text>
                <text
                  x={rightAngleX + sideB / 2}
                  y={rightAngleY + 90}
                  fontSize={baseFontSize}
                  fill={textColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={lengthOpacityB}
                >
                  4
                </text>
                <text
                  x={rightAngleX + sideB / 2 + 20}
                  y={topVertexY + sideA / 2 + 50}
                  fontSize={baseFontSize}
                  fill={textColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={lengthOpacityC}
                  transform={`rotate(${angleCSquareRotation}, ${rightAngleX + sideB / 2}, ${topVertexY + sideA / 2})`}
                >
                  5
                </text>
              </svg>
            </AbsoluteFill>
          );
        }}
      </Sequence>

      {/* Scene 3: Draw Squares & Areas */}
      <Sequence from={fps * 13} durationInFrames={fps * 15}>
        {(frame) => {
          const mainOpacity = fadeIn(frame, 0, fps);

          // Square A
          const squareAProgress = interpolate(frame, [0, 40], [0, 1], {
            extrapolateRight: "clamp",
          });
          const squareAFillOpacity = fadeIn(frame, 30, 60);
          const areaAOpacity = fadeIn(frame, 60, 80);

          // Square B
          const squareBProgress = interpolate(frame, [50, 90], [0, 1], {
            extrapolateRight: "clamp",
          });
          const squareBFillOpacity = fadeIn(frame, 80, 110);
          const areaBOpacity = fadeIn(frame, 110, 130);

          // Square C
          const squareCProgress = interpolate(frame, [100, 140], [0, 1], {
            extrapolateRight: "clamp",
          });
          const squareCFillOpacity = fadeIn(frame, 130, 160);
          const areaCOpacity = fadeIn(frame, 160, 180);

          return (
            <AbsoluteFill style={{ opacity: mainOpacity }}>
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 1920 1080`}
                style={{ position: "absolute" }}
              >
                {/* Triangle background lines (always visible in this sequence) */}
                <line
                  x1={topVertexX}
                  y1={topVertexY}
                  x2={rightAngleX}
                  y2={rightAngleY}
                  stroke={sideAColor}
                  strokeWidth="8"
                />
                <line
                  x1={rightAngleX}
                  y1={rightAngleY}
                  x2={rightVertexX}
                  y2={rightVertexY}
                  stroke={sideBColor}
                  strokeWidth="8"
                />
                <line
                  x1={topVertexX}
                  y1={topVertexY}
                  x2={rightVertexX}
                  y2={rightVertexY}
                  stroke={sideCColor}
                  strokeWidth="8"
                />

                {/* Labels a, b, c */}
                <text
                  x={topVertexX - 40}
                  y={topVertexY + sideA / 2 + 15}
                  fontSize={labelFontSize}
                  fill={sideAColor}
                  fontFamily="sans-serif"
                  textAnchor="end"
                >
                  a
                </text>
                <text
                  x={rightAngleX + sideB / 2}
                  y={rightAngleY + 60}
                  fontSize={labelFontSize}
                  fill={sideBColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                >
                  b
                </text>
                <text
                  x={rightAngleX + sideB / 2 + 20}
                  y={topVertexY + sideA / 2 - 20}
                  fontSize={labelFontSize}
                  fill={sideCColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  transform={`rotate(${angleCSquareRotation}, ${rightAngleX + sideB / 2}, ${topVertexY + sideA / 2})`}
                >
                  c
                </text>

                {/* Square A (side 'a') */}
                <rect
                  x={topVertexX - sideA}
                  y={topVertexY}
                  width={sideA}
                  height={sideA}
                  stroke={sideAColor}
                  strokeWidth="6"
                  fill={sideAColor}
                  fillOpacity={squareAFillOpacity}
                  strokeDasharray={sideA * 4}
                  strokeDashoffset={sideA * 4 * (1 - squareAProgress)}
                />
                <text
                  x={topVertexX - sideA / 2}
                  y={topVertexY + sideA / 2 + baseFontSize / 3}
                  fontSize={equationFontSize}
                  fill={textColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={areaAOpacity}
                  fontWeight="bold"
                >
                  9
                </text>

                {/* Square B (side 'b') */}
                <rect
                  x={rightAngleX}
                  y={rightAngleY}
                  width={sideB}
                  height={sideB}
                  stroke={sideBColor}
                  strokeWidth="6"
                  fill={sideBColor}
                  fillOpacity={squareBFillOpacity}
                  strokeDasharray={sideB * 4}
                  strokeDashoffset={sideB * 4 * (1 - squareBProgress)}
                />
                <text
                  x={rightAngleX + sideB / 2}
                  y={rightAngleY + sideB / 2 + baseFontSize / 3}
                  fontSize={equationFontSize}
                  fill={textColor}
                  fontFamily="sans-serif"
                  textAnchor="middle"
                  opacity={areaBOpacity}
                  fontWeight="bold"
                >
                  16
                </text>

                {/* Square C (side 'c') */}
                <g
                  transform={`translate(${rightVertexX}, ${rightVertexY}) rotate(${angleCSquareRotation})`}
                >
                  <rect
                    x={0}
                    y={0}
                    width={sideC}
                    height={sideC}
                    stroke={sideCColor}
                    strokeWidth="6"
                    fill={sideCColor}
                    fillOpacity={squareCFillOpacity}
                    strokeDasharray={sideC * 4}
                    strokeDashoffset={sideC * 4 * (1 - squareCProgress)}
                    transform={`translate(${0}, ${-sideC})`}
                  />
                  <text
                    x={sideC / 2}
                    y={-sideC / 2 + baseFontSize / 3}
                    fontSize={equationFontSize}
                    fill={textColor}
                    fontFamily="sans-serif"
                    textAnchor="middle"
                    opacity={areaCOpacity}
                    fontWeight="bold"
                  >
                    25
                  </text>
                </g>
              </svg>
            </AbsoluteFill>
          );
        }}
      </Sequence>

      {/* Scene 4: Equation a^2 + b^2 = c^2 and 9 + 16 = 25 */}
      <Sequence from={fps * 28} durationInFrames={fps * 12}>
        {(frame) => {
          const mainOpacity = fadeIn(frame, 0, fps);

          const parts = ["a²", " + ", "b²", " = ", "c²"];
          const values = ["9", " + ", "16", " = ", "25"];

          // Animation for a^2 + b^2 = c^2
          const equationScale = parts.map((_, i) =>
            spring({
              frame: frame - i * 15, // Staggered appearance
              fps,
              config: { damping: 200, stiffness: 200, mass: 1 },
              durationInFrames: 30,
            })
          );
          const equationOpacity = parts.map((_, i) =>
            fadeIn(frame, i * 15, i * 15 + 15)
          );

          // Animation for numbers
          const valueScale = values.map((_, i) =>
            spring({
              frame: frame - (fps * 2 + i * 10), // Start after equation, staggered
              fps,
              config: { damping: 200, stiffness: 200, mass: 1 },
              durationInFrames: 20,
            })
          );
          const valueOpacity = values.map((_, i) =>
            fadeIn(frame, fps * 2 + i * 10, fps * 2 + i * 10 + 10)
          );
          const initialEquationFadeOut = fadeOut(frame, fps * 2 - 15, fps * 2);

          return (
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                opacity: mainOpacity,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: equationFontSize,
                  fontFamily: "sans-serif",
                  color: textColor,
                  fontWeight: "bold",
                }}
              >
                {parts.map((part, i) => (
                  <span
                    key={i}
                    style={{
                      transform: `scale(${equationScale[i]})`,
                      opacity: equationOpacity[i] * initialEquationFadeOut,
                      whiteSpace: "pre",
                      color:
                        part === "a²"
                          ? sideAColor
                          : part === "b²"
                            ? sideBColor
                            : part === "c²"
                              ? sideCColor
                              : textColor,
                    }}
                  >
                    {part}
                  </span>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: equationFontSize,
                  fontFamily: "sans-serif",
                  color: textColor,
                  fontWeight: "bold",
                  marginTop: 20,
                }}
              >
                {values.map((value, i) => (
                  <span
                    key={`val-${i}`}
                    style={{
                      transform: `scale(${valueScale[i]})`,
                      opacity: valueOpacity[i],
                      whiteSpace: "pre",
                      color:
                        value === "9"
                          ? sideAColor
                          : value === "16"
                            ? sideBColor
                            : value === "25"
                              ? sideCColor
                              : textColor,
                    }}
                  >
                    {value}
                  </span>
                ))}
              </div>
            </AbsoluteFill>
          );
        }}
      </Sequence>

      {/* Scene 5: Summary Line */}
      <Sequence from={fps * 40} durationInFrames={fps * 5}>
        {(frame) => {
          const opacity = fadeIn(frame, 0, fps);
          return (
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                opacity,
              }}
            >
              <p
                style={{
                  fontSize: baseFontSize,
                  color: textColor,
                  fontFamily: "sans-serif",
                  textAlign: "center",
                  lineHeight: 1.4,
                  padding: "0 100px",
                }}
              >
                In a right triangle, the square of the hypotenuse equals the sum
                of the squares of the other two sides.
              </p>
            </AbsoluteFill>
          );
        }}
      </Sequence>
    </AbsoluteFill>
  );
};