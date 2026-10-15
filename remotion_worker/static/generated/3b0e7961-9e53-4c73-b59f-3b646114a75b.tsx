import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const DURATION_SECONDS = 30;

interface ParticleData {
  id: number;
  solidX: number;
  solidY: number;
  liquidBaseX: number;
  liquidBaseY: number;
  liquidPhase: number;
  liquidSpeed: number;
  gasVx: number;
  gasVy: number;
  gasStartX: number;
  gasStartY: number;
}

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ----------------------------------------------------
  // PARTICLE POSITIONS SETUP (24 particles)
  // ----------------------------------------------------
  const particles: ParticleData[] = useMemo(() => {
    const list: ParticleData[] = [];
    const cols = 5;
    const rows = 5;
    let count = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 0 && (c === 0 || c === 4)) continue; // 23 particles, rounded cluster
        const sx = (c - 2) * 58;
        const sy = (r - 2) * 58 + 20;

        // Deterministic pseudo-random values based on index
        const angle = (count * 137.5 * Math.PI) / 180;
        const radius = 40 + (count % 4) * 35;
        const lx = Math.cos(angle) * radius * 1.8;
        const ly = 50 + ((count % 5) - 2) * 30 + Math.sin(angle) * 30;

        const gAngle = (count * 47.3 * Math.PI) / 180;
        const speed = 4.5 + (count % 3) * 2;

        list.push({
          id: count,
          solidX: sx,
          solidY: sy,
          liquidBaseX: lx,
          liquidBaseY: ly,
          liquidPhase: count * 0.8,
          liquidSpeed: 0.08 + (count % 4) * 0.02,
          gasVx: Math.cos(gAngle) * speed,
          gasVy: Math.sin(gAngle) * speed,
          gasStartX: Math.cos(angle) * 70,
          gasStartY: Math.sin(angle) * 70,
        });
        count++;
      }
    }
    return list;
  }, []);

  // ----------------------------------------------------
  // TIMELINE STAGES (30s = 600 frames at 20fps)
  // Stage 0: 0   - 60  (3s)  -> Intro Title
  // Stage 1: 60  - 220 (8s)  -> SOLID (Ice Cube)
  // Stage 2: 220 - 410 (9.5s)-> LIQUID (Water)
  // Stage 3: 410 - 560 (7.5s)-> GAS (Steam)
  // Stage 4: 560 - 600 (2s)  -> Summary Outro
  // ----------------------------------------------------

  // Intro card animation
  const introOpacity = interpolate(frame, [0, 15, 48, 60], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introScale = interpolate(frame, [0, 20], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });

  // Main interface appearance
  const mainUiOpacity = interpolate(frame, [52, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Transitions between states
  // Melt transition: 200 - 240
  const meltProgress = interpolate(frame, [200, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Boil transition: 380 - 430
  const boilProgress = interpolate(frame, [380, 430], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Current active stage key
  let currentStageIndex = 0;
  if (frame >= 60 && frame < 220) currentStageIndex = 1;
  else if (frame >= 220 && frame < 410) currentStageIndex = 2;
  else if (frame >= 410) currentStageIndex = 3;

  // Heat flame indicator
  const showFlame =
    (frame >= 180 && frame <= 245) || (frame >= 370 && frame <= 445);
  const flameIntensity = interpolate(
    frame,
    [180, 200, 235, 250, 370, 395, 435, 450],
    [0, 1, 1, 0, 0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Background gradient tint shifts smoothly
  const bgTheme =
    currentStageIndex === 1
      ? "#F0F9FF"
      : currentStageIndex === 2
      ? "#EFF6FF"
      : "#FAF5FF";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgTheme,
        fontFamily: "sans-serif",
        color: "#0F172A",
        overflow: "hidden",
      }}
    >
      {/* ==================================================== */}
      {/* 1. INTRO OVERLAY (Frames 0 - 60)                     */}
      {/* ==================================================== */}
      {frame < 65 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#0284C7",
            opacity: introOpacity,
            zIndex: 100,
          }}
        >
          <div
            style={{
              textAlign: "center",
              transform: `scale(${introScale})`,
              padding: "40px 80px",
              borderRadius: "36px",
              backgroundColor: "#FFFFFF",
              boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
            }}
          >
            <div
              style={{
                fontSize: 46,
                fontWeight: 800,
                color: "#0284C7",
                letterSpacing: "4px",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Class 6 Science
            </div>
            <div
              style={{
                fontSize: 92,
                fontWeight: 900,
                color: "#0F172A",
                lineHeight: 1.15,
                marginBottom: 24,
              }}
            >
              Three States of Matter
            </div>
            <div
              style={{
                display: "flex",
                gap: 24,
                justifyContent: "center",
                marginTop: 20,
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  backgroundColor: "#E0F2FE",
                  color: "#0369A1",
                  padding: "12px 32px",
                  borderRadius: "20px",
                }}
              >
                1. SOLID
              </span>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  backgroundColor: "#DBEAFE",
                  color: "#1D4ED8",
                  padding: "12px 32px",
                  borderRadius: "20px",
                }}
              >
                2. LIQUID
              </span>
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  backgroundColor: "#F3E8FF",
                  color: "#7E22CE",
                  padding: "12px 32px",
                  borderRadius: "20px",
                }}
              >
                3. GAS
              </span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* ==================================================== */}
      {/* 2. MAIN LESSON STAGE                                 */}
      {/* ==================================================== */}
      <AbsoluteFill style={{ opacity: mainUiOpacity }}>
        {/* TOP HEADER & STAGE TABS */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 80,
            right: 80,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "3px",
              }}
            >
              States of Matter
            </span>
            <div style={{ fontSize: 72, fontWeight: 900, color: "#0F172A" }}>
              {currentStageIndex === 1 && "1. Solid: Ice Cube"}
              {currentStageIndex === 2 && "2. Liquid: Water"}
              {currentStageIndex === 3 && "3. Gas: Steam / Vapor"}
              {currentStageIndex === 0 && "Overview"}
            </div>
          </div>

          {/* Three step indicators */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { num: "1", name: "SOLID", color: "#0284C7" },
              { num: "2", name: "LIQUID", color: "#2563EB" },
              { num: "3", name: "GAS", color: "#9333EA" },
            ].map((st, i) => {
              const active = currentStageIndex === i + 1;
              return (
                <div
                  key={st.num}
                  style={{
                    padding: "14px 28px",
                    borderRadius: "18px",
                    backgroundColor: active ? st.color : "#E2E8F0",
                    color: active ? "#FFFFFF" : "#64748B",
                    fontSize: 42,
                    fontWeight: 800,
                    transition: "background-color 0.3s",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: active
                      ? "0 8px 24px rgba(0,0,0,0.15)"
                      : "none",
                  }}
                >
                  <span>{st.num}.</span>
                  <span>{st.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEFT COLUMN: REAL-WORLD OBJECT (BEAKER / ICE / WATER / STEAM) */}
        <div
          style={{
            position: "absolute",
            top: 200,
            left: 100,
            width: 720,
            height: 600,
            backgroundColor: "#FFFFFF",
            borderRadius: "36px",
            border: "6px solid #CBD5E1",
            boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 40,
            overflow: "hidden",
          }}
        >
          {/* Card Label */}
          <div
            style={{
              position: "absolute",
              top: 28,
              left: 36,
              fontSize: 44,
              fontWeight: 800,
              color: "#334155",
            }}
          >
            Real Object View
          </div>

          {/* Heating indicator message */}
          {flameIntensity > 0 && (
            <div
              style={{
                position: "absolute",
                top: 30,
                right: 36,
                backgroundColor: "#FEF2F2",
                border: "4px solid #EF4444",
                borderRadius: "16px",
                padding: "8px 24px",
                fontSize: 36,
                fontWeight: 800,
                color: "#DC2626",
                opacity: flameIntensity,
              }}
            >
              🔥 Adding Heat...
            </div>
          )}

          {/* SVG Visual Stage: Beaker + Ice + Water + Steam */}
          <svg
            width="500"
            height="440"
            viewBox="0 0 500 440"
            style={{ overflow: "visible" }}
          >
            {/* Steam wisps rising when boiling */}
            {boilProgress > 0.05 && (
              <g
                style={{
                  opacity: interpolate(boilProgress, [0.05, 0.4], [0, 1]),
                }}
              >
                {[0, 1, 2].map((idx) => {
                  const yOffset = ((frame * 6 + idx * 70) % 220);
                  const xWave = Math.sin(frame * 0.15 + idx) * 20;
                  const steamOpacity = interpolate(
                    yOffset,
                    [0, 50, 180, 220],
                    [0, 0.8, 0.8, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  );
                  const steamScale = interpolate(yOffset, [0, 220], [0.8, 1.6]);
                  return (
                    <circle
                      key={idx}
                      cx={200 + idx * 50 + xWave}
                      cy={140 - yOffset}
                      r={30 * steamScale}
                      fill="#C084FC"
                      opacity={steamOpacity * 0.7}
                    />
                  );
                })}
              </g>
            )}

            {/* Glass Beaker Body */}
            <path
              d="M 120 100 L 120 340 A 30 30 0 0 0 150 370 L 350 370 A 30 30 0 0 0 380 340 L 380 100"
              fill="none"
              stroke="#64748B"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Beaker lip */}
            <path
              d="M 100 100 L 130 100"
              stroke="#64748B"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 370 100 L 400 100"
              stroke="#64748B"
              strokeWidth="10"
              strokeLinecap="round"
            />
            {/* Measurement lines */}
            <line
              x1="350"
              y1="180"
              x2="320"
              y2="180"
              stroke="#94A3B8"
              strokeWidth="6"
            />
            <line
              x1="350"
              y1="240"
              x2="310"
              y2="240"
              stroke="#94A3B8"
              strokeWidth="6"
            />
            <line
              x1="350"
              y1="300"
              x2="320"
              y2="300"
              stroke="#94A3B8"
              strokeWidth="6"
            />

            {/* Liquid Water Pool */}
            {meltProgress > 0 && (
              <g>
                <path
                  d={`M 130 ${360 - meltProgress * 120} 
                      Q 250 ${360 - meltProgress * 120 + Math.sin(frame * 0.3) * (boilProgress > 0.3 ? 12 : 4)} 370 ${360 - meltProgress * 120} 
                      L 370 345 A 25 25 0 0 1 345 365 L 155 365 A 25 25 0 0 1 130 345 Z`}
                  fill={boilProgress > 0.2 ? "#60A5FA" : "#38BDF8"}
                  opacity="0.85"
                />
                {/* Boiling bubbles inside water */}
                {boilProgress > 0.2 && (
                  <g>
                    {[40, 80, 140, 190].map((bOffset, i) => {
                      const bubbleY = 350 - ((frame * 4 + i * 25) % 100);
                      return (
                        <circle
                          key={i}
                          cx={160 + bOffset}
                          cy={bubbleY}
                          r={7 + (i % 3) * 3}
                          fill="#FFFFFF"
                          opacity="0.8"
                        />
                      );
                    })}
                  </g>
                )}
              </g>
            )}

            {/* Solid Ice Cube (shrinks & fades as it melts) */}
            {meltProgress < 1 && (
              <g
                transform={`translate(250, ${280 + meltProgress * 40}) scale(${
                  (1 - meltProgress * 0.85)
                }) translate(-75, -75)`}
                opacity={1 - meltProgress * 0.9}
              >
                {/* 3D Ice Cube Shape */}
                <polygon
                  points="20,50 75,20 130,50 75,80"
                  fill="#BAE6FD"
                  stroke="#0284C7"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <polygon
                  points="20,50 75,80 75,135 20,105"
                  fill="#7DD3FC"
                  stroke="#0284C7"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <polygon
                  points="75,80 130,50 130,105 75,135"
                  fill="#38BDF8"
                  stroke="#0284C7"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                {/* Frost highlights */}
                <line
                  x1="45"
                  y1="68"
                  x2="45"
                  y2="92"
                  stroke="#FFFFFF"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line
                  x1="95"
                  y1="75"
                  x2="115"
                  y2="65"
                  stroke="#FFFFFF"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </g>
            )}

            {/* Bunsen Flame beneath beaker when heat applied */}
            {flameIntensity > 0 && (
              <g
                transform="translate(250, 420)"
                opacity={flameIntensity}
              >
                <ellipse
                  cx="0"
                  cy="0"
                  rx="45"
                  ry="24"
                  fill="#F97316"
                  transform={`scale(${1 + Math.sin(frame * 0.8) * 0.15})`}
                />
                <ellipse
                  cx="0"
                  cy="-6"
                  rx="24"
                  ry="16"
                  fill="#FACC15"
                  transform={`scale(${1 + Math.cos(frame * 0.9) * 0.2})`}
                />
              </g>
            )}
          </svg>
        </div>

        {/* RIGHT COLUMN: MICROSCOPIC PARTICLE VIEW */}
        <div
          style={{
            position: "absolute",
            top: 200,
            right: 100,
            width: 840,
            height: 600,
            backgroundColor: "#FFFFFF",
            borderRadius: "36px",
            border: "6px solid #CBD5E1",
            boxShadow: "0 20px 40px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "28px 40px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 44, fontWeight: 800, color: "#334155" }}>
              🔬 Particle View (Zoom-in)
            </span>
            <span
              style={{
                fontSize: 34,
                fontWeight: 700,
                color:
                  currentStageIndex === 1
                    ? "#0369A1"
                    : currentStageIndex === 2
                    ? "#1D4ED8"
                    : "#7E22CE",
                backgroundColor:
                  currentStageIndex === 1
                    ? "#E0F2FE"
                    : currentStageIndex === 2
                    ? "#DBEAFE"
                    : "#F3E8FF",
                padding: "6px 18px",
                borderRadius: "12px",
              }}
            >
              {currentStageIndex === 1 && "Vibrating in Fixed Position"}
              {currentStageIndex === 2 && "Free to Slide & Flow"}
              {currentStageIndex === 3 && "Moving Fast & Far Apart"}
            </span>
          </div>

          {/* Big Magnifying Lens Container */}
          <div
            style={{
              position: "relative",
              width: 480,
              height: 480,
              borderRadius: "50%",
              border: "12px solid #38BDF8",
              backgroundColor: "#F8FAFC",
              boxShadow: "inset 0 10px 30px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            {/* Center origin helper div */}
            <div
              style={{
                position: "absolute",
                top: 240,
                left: 240,
                width: 0,
                height: 0,
              }}
            >
              {particles.map((p) => {
                // 1. SOLID POS: tight grid + tiny vibration
                const vibX = Math.sin(frame * 0.9 + p.id * 1.7) * 4.5;
                const vibY = Math.cos(frame * 1.1 + p.id * 2.3) * 4.5;
                const solidX = p.solidX + vibX;
                const solidY = p.solidY + vibY;

                // 2. LIQUID POS: lower half, sliding around each other
                const driftX =
                  p.liquidBaseX +
                  Math.sin(frame * p.liquidSpeed + p.liquidPhase) * 35;
                const driftY =
                  p.liquidBaseY +
                  Math.cos(frame * p.liquidSpeed * 1.3 + p.liquidPhase) * 16;

                // 3. GAS POS: spread widely, moving fast within circle radius (~200)
                const gasFrame = Math.max(0, frame - 390);
                // Bouncing inside a box of [-180, 180]
                const rawGx = p.gasStartX + p.gasVx * gasFrame;
                const rawGy = p.gasStartY + p.gasVy * gasFrame;
                // Periodic ping-pong bounce inside radius
                const bounce = (val: number, range: number) => {
                  const mod = ((val % (range * 2)) + range * 2) % (range * 2);
                  return mod > range ? range * 2 - mod - range / 2 : mod - range / 2;
                };
                const gasX = bounce(rawGx, 340);
                const gasY = bounce(rawGy, 340);

                // Blending between states:
                // Solid -> Liquid (meltProgress 0 to 1)
                const slX = interpolate(meltProgress, [0, 1], [solidX, driftX]);
                const slY = interpolate(meltProgress, [0, 1], [solidY, driftY]);

                // Liquid -> Gas (boilProgress 0 to 1)
                const currentX = interpolate(boilProgress, [0, 1], [slX, gasX]);
                const currentY = interpolate(boilProgress, [0, 1], [slY, gasY]);

                // Particle color transitions
                const particleColor =
                  boilProgress > 0.5
                    ? "#A855F7"
                    : meltProgress > 0.5
                    ? "#2563EB"
                    : "#0284C7";

                return (
                  <div
                    key={p.id}
                    style={{
                      position: "absolute",
                      transform: `translate(${currentX - 22}px, ${
                        currentY - 22
                      }px)`,
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      backgroundColor: particleColor,
                      boxShadow: "0 6px 12px rgba(0,0,0,0.2)",
                      border: "3px solid #FFFFFF",
                    }}
                  >
                    {/* 3D sphere highlight */}
                    <div
                      style={{
                        position: "absolute",
                        top: 5,
                        left: 7,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        backgroundColor: "rgba(255,255,255,0.7)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM EXPLANATION BANNER */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 100,
            right: 100,
            height: 180,
            backgroundColor: "#FFFFFF",
            borderRadius: "32px",
            border: "5px solid #CBD5E1",
            display: "flex",
            alignItems: "center",
            padding: "0 50px",
            gap: 40,
            boxShadow: "0 15px 35px rgba(0,0,0,0.05)",
          }}
        >
          {/* Key Rule Icon */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              backgroundColor:
                currentStageIndex === 1
                  ? "#E0F2FE"
                  : currentStageIndex === 2
                  ? "#DBEAFE"
                  : "#F3E8FF",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 54,
              flexShrink: 0,
            }}
          >
            {currentStageIndex === 1 && "🧊"}
            {currentStageIndex === 2 && "💧"}
            {currentStageIndex === 3 && "💨"}
          </div>

          {/* Explanation text */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 54,
                fontWeight: 900,
                color:
                  currentStageIndex === 1
                    ? "#0369A1"
                    : currentStageIndex === 2
                    ? "#1D4ED8"
                    : "#7E22CE",
                lineHeight: 1.2,
                marginBottom: 6,
              }}
            >
              {currentStageIndex === 1 &&
                "Solid: Particles are tightly packed and vibrate in place."}
              {currentStageIndex === 2 &&
                "Liquid: Particles slide past one another and take shape of container."}
              {currentStageIndex === 3 &&
                "Gas: Particles move very fast with lots of empty space between them!"}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#64748B" }}>
              {currentStageIndex === 1 &&
                "Fixed Shape • Fixed Volume • High Particle Attraction"}
              {currentStageIndex === 2 &&
                "No Fixed Shape • Fixed Volume • Medium Particle Attraction"}
              {currentStageIndex === 3 &&
                "No Fixed Shape • No Fixed Volume • Very Weak Attraction"}
            </div>
          </div>
        </div>
      </AbsoluteFill>

      {/* ==================================================== */}
      {/* 3. FINAL SUMMARY RECAP (Frames 550 - 600)             */}
      {/* ==================================================== */}
      {frame >= 550 && (
        <AbsoluteFill
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.94)",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 110,
            opacity: interpolate(frame, [550, 565], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div style={{ textAlign: "center", color: "#FFFFFF" }}>
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: "#38BDF8",
                letterSpacing: "4px",
                marginBottom: 16,
              }}
            >
              SUMMARY RECAP
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                marginBottom: 60,
              }}
            >
              Matter Changes With Heat!
            </div>

            <div style={{ display: "flex", gap: 50, justifyContent: "center" }}>
              <div
                style={{
                  backgroundColor: "#0284C7",
                  padding: "40px 50px",
                  borderRadius: "28px",
                  width: 380,
                }}
              >
                <div style={{ fontSize: 72 }}>🧊</div>
                <div style={{ fontSize: 52, fontWeight: 900, marginTop: 12 }}>
                  SOLID
                </div>
                <div style={{ fontSize: 34, opacity: 0.9, marginTop: 8 }}>
                  Tightly Packed
                </div>
              </div>

              <div
                style={{
                  fontSize: 70,
                  alignSelf: "center",
                  color: "#FACC15",
                  fontWeight: 900,
                }}
              >
                ➔
              </div>

              <div
                style={{
                  backgroundColor: "#2563EB",
                  padding: "40px 50px",
                  borderRadius: "28px",
                  width: 380,
                }}
              >
                <div style={{ fontSize: 72 }}>💧</div>
                <div style={{ fontSize: 52, fontWeight: 900, marginTop: 12 }}>
                  LIQUID
                </div>
                <div style={{ fontSize: 34, opacity: 0.9, marginTop: 8 }}>
                  Loosely Packed
                </div>
              </div>

              <div
                style={{
                  fontSize: 70,
                  alignSelf: "center",
                  color: "#FACC15",
                  fontWeight: 900,
                }}
              >
                ➔
              </div>

              <div
                style={{
                  backgroundColor: "#9333EA",
                  padding: "40px 50px",
                  borderRadius: "28px",
                  width: 380,
                }}
              >
                <div style={{ fontSize: 72 }}>💨</div>
                <div style={{ fontSize: 52, fontWeight: 900, marginTop: 12 }}>
                  GAS
                </div>
                <div style={{ fontSize: 34, opacity: 0.9, marginTop: 8 }}>
                  Far Apart & Free
                </div>
              </div>
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};