import React, { useMemo } from "react";
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

  // Particle definition for micro zoom view
  const particles = useMemo(
    () => [
      { id: 0, gx: -90, gy: -90, phase: 0.2 },
      { id: 1, gx: -30, gy: -90, phase: 1.1 },
      { id: 2, gx: 30, gy: -90, phase: 2.4 },
      { id: 3, gx: 90, gy: -90, phase: 3.7 },
      { id: 4, gx: -90, gy: -30, phase: 4.2 },
      { id: 5, gx: -30, gy: -30, phase: 0.8 },
      { id: 6, gx: 30, gy: -30, phase: 5.1 },
      { id: 7, gx: 90, gy: -30, phase: 1.9 },
      { id: 8, gx: -90, gy: 30, phase: 3.2 },
      { id: 9, gx: -30, gy: 30, phase: 4.8 },
      { id: 10, gx: 30, gy: 30, phase: 2.0 },
      { id: 11, gx: 90, gy: 30, phase: 0.5 },
      { id: 12, gx: -90, gy: 90, phase: 1.6 },
      { id: 13, gx: -30, gy: 90, phase: 3.9 },
      { id: 14, gx: 30, gy: 90, phase: 5.4 },
      { id: 15, gx: 90, gy: 90, phase: 2.8 },
    ],
    []
  );

  // Timeline phase weights
  // Intro: 0 - 70
  // Solid: 70 - 220
  // Melting transition: 210 - 250
  // Liquid: 240 - 380
  // Boiling transition: 370 - 410
  // Gas: 400 - 525
  // Summary: 525 - 600

  const introOpacity = interpolate(frame, [0, 15, 60, 72], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const summaryOpacity = interpolate(frame, [520, 535], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dynamic state blend weights for particles
  const solidWeight = interpolate(frame, [210, 245], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const liquidWeight =
    interpolate(frame, [210, 245], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [370, 405], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const gasWeight = interpolate(frame, [370, 405], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Current active step index for UI tabs (0: Solid, 1: Liquid, 2: Gas)
  const currentStep = frame < 235 ? 0 : frame < 390 ? 1 : 2;

  // Ice cube melting into liquid
  const iceMeltProgress = interpolate(frame, [215, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const iceSize = 130 * (1 - iceMeltProgress);
  const iceOpacity = 1 - iceMeltProgress;

  // Water level in beaker
  const waterLevel = interpolate(
    frame,
    [215, 265, 410, 520],
    [0, 95, 95, 65],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Flame intensity
  const flameIntensity = interpolate(
    frame,
    [195, 230, 360, 395],
    [0, 0.7, 0.7, 1.2],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Steam opacity & count
  const steamOpacity = interpolate(frame, [380, 415], [0, 0.9], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F8FAFC",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "#0F172A",
        overflow: "hidden",
      }}
    >
      {/* Background Subtle Grid Pattern */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          opacity: 0.25,
        }}
      >
        <defs>
          <pattern
            id="subtle-grid"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#subtle-grid)" />
      </svg>

      {/* Main Header */}
      <header
        style={{
          position: "absolute",
          top: 40,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#64748B",
            }}
          >
            Class 6 Science • States of Matter
          </span>
          <h1
            style={{
              fontSize: 54,
              fontWeight: 900,
              margin: "4px 0 0 0",
              color: "#0F172A",
            }}
          >
            How Matter Changes Its State
          </h1>
        </div>

        {/* 3 States Badges Indicator */}
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { label: "1. SOLID", color: "#0284C7" },
            { label: "2. LIQUID", color: "#2563EB" },
            { label: "3. GAS", color: "#7C3AED" },
          ].map((item, idx) => {
            const isActive = currentStep === idx;
            return (
              <div
                key={idx}
                style={{
                  padding: "12px 28px",
                  borderRadius: 16,
                  fontSize: 26,
                  fontWeight: 800,
                  backgroundColor: isActive ? item.color : "#E2E8F0",
                  color: isActive ? "#FFFFFF" : "#64748B",
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  boxShadow: isActive
                    ? "0 10px 25px -5px rgba(0,0,0,0.2)"
                    : "none",
                  transition: "all 0.3s ease",
                }}
              >
                {item.label}
              </div>
            );
          })}
        </div>
      </header>

      {/* LEFT CONTAINER: Macroscopic View (Beaker, Heat & State Transition) */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 80,
          width: 820,
          height: 840,
          backgroundColor: "#FFFFFF",
          borderRadius: 32,
          boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.07)",
          border: "2px solid #E2E8F0",
          padding: 40,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Card Title */}
        <div
          style={{
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "#2563EB",
            }}
          />
          <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>
            Observation: What We See
          </h2>
        </div>

        {/* Beaker & Flame Illustration */}
        <div
          style={{
            position: "relative",
            width: 500,
            height: 520,
            marginTop: 20,
          }}
        >
          <svg width="500" height="520" viewBox="0 0 500 520">
            {/* Steam Wisps */}
            {steamOpacity > 0.05 && (
              <g opacity={steamOpacity}>
                {[0, 1, 2, 3].map((i) => {
                  const steamY =
                    130 - (((frame * 4 + i * 55) % 180) as number);
                  const steamX =
                    180 +
                    i * 45 +
                    Math.sin(frame * 0.15 + i) * 20;
                  const steamFade = interpolate(
                    steamY,
                    [130, 40, -40],
                    [0, 0.9, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  );
                  return (
                    <path
                      key={i}
                      d={`M ${steamX} ${steamY + 40} Q ${steamX - 25} ${steamY + 20}, ${steamX} ${steamY} T ${steamX} ${steamY - 30}`}
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="9"
                      strokeLinecap="round"
                      opacity={steamFade}
                    />
                  );
                })}
              </g>
            )}

            {/* Beaker Outline */}
            <path
              d="M 110 90 L 120 110 L 120 370 Q 120 400 150 400 L 350 400 Q 380 400 380 370 L 380 110 L 390 90"
              fill="rgba(241, 245, 249, 0.45)"
              stroke="#64748B"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Beaker Measurement Lines */}
            {[180, 240, 300, 360].map((yVal, i) => (
              <g key={i}>
                <line
                  x1="330"
                  y1={yVal}
                  x2="370"
                  y2={yVal}
                  stroke="#94A3B8"
                  strokeWidth="4"
                />
                <text
                  x="300"
                  y={yVal + 6}
                  fontSize="18"
                  fontWeight="700"
                  fill="#94A3B8"
                  textAnchor="end"
                >
                  {(4 - i) * 50} ml
                </text>
              </g>
            ))}

            {/* Water Inside Beaker */}
            {waterLevel > 0 && (
              <g>
                <path
                  d={`M 125 ${395 - waterLevel * 2.2} 
                      Q 250 ${395 - waterLevel * 2.2 + (frame % 10 > 5 ? 4 : -4)} 375 ${395 - waterLevel * 2.2} 
                      L 375 395 Q 375 395 350 395 L 150 395 Q 125 395 125 395 Z`}
                  fill="#0284C7"
                  opacity="0.65"
                />
                {/* Boiling Bubbles */}
                {flameIntensity > 0.9 &&
                  [0, 1, 2, 3, 4].map((b) => {
                    const bubbleY =
                      385 - (((frame * 5 + b * 28) % (waterLevel * 2)) as number);
                    const bubbleX = 160 + b * 40 + Math.sin(frame + b) * 8;
                    return (
                      <circle
                        key={b}
                        cx={bubbleX}
                        cy={bubbleY}
                        r={6 + (b % 3) * 2}
                        fill="#FFFFFF"
                        opacity="0.75"
                      />
                    );
                  })}
              </g>
            )}

            {/* Ice Cube (Solid Phase) */}
            {iceOpacity > 0.02 && (
              <g
                opacity={iceOpacity}
                transform={`translate(${250 - iceSize / 2}, ${385 - iceSize})`}
              >
                {/* 3D Ice Cube Shape */}
                <rect
                  x="0"
                  y="0"
                  width={iceSize}
                  height={iceSize}
                  rx={iceSize * 0.12}
                  fill="#7DD3FC"
                  stroke="#0284C7"
                  strokeWidth="5"
                />
                {/* Ice highlights */}
                <rect
                  x={iceSize * 0.15}
                  y={iceSize * 0.15}
                  width={iceSize * 0.3}
                  height={iceSize * 0.3}
                  rx="6"
                  fill="#FFFFFF"
                  opacity="0.6"
                />
              </g>
            )}

            {/* Burner Stand */}
            <line
              x1="90"
              y1="430"
              x2="410"
              y2="430"
              stroke="#334155"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <line
              x1="120"
              y1="430"
              x2="90"
              y2="510"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line
              x1="380"
              y1="430"
              x2="410"
              y2="510"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Burner Flame */}
            {flameIntensity > 0.1 && (
              <g
                transform={`translate(250, 480) scale(${
                  flameIntensity * (1 + Math.sin(frame * 0.8) * 0.08)
                }) translate(-250, -480)`}
              >
                {/* Outer Flame */}
                <path
                  d="M 250 435 Q 230 465 235 485 Q 240 500 250 500 Q 260 500 265 485 Q 270 465 250 435 Z"
                  fill="#EA580C"
                />
                {/* Inner Flame */}
                <path
                  d="M 250 450 Q 240 470 242 485 Q 245 495 250 495 Q 255 495 258 485 Q 260 470 250 450 Z"
                  fill="#FBBF24"
                />
              </g>
            )}
          </svg>
        </div>

        {/* Current State Label Box */}
        <div
          style={{
            marginTop: "auto",
            width: "100%",
            backgroundColor:
              currentStep === 0
                ? "#E0F2FE"
                : currentStep === 1
                ? "#DBEAFE"
                : "#EDE9FE",
            borderRadius: 20,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
              }}
            >
              Current State & Temperature
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color:
                  currentStep === 0
                    ? "#0284C7"
                    : currentStep === 1
                    ? "#1D4ED8"
                    : "#6D28D9",
              }}
            >
              {currentStep === 0
                ? "Solid: Ice Cube (0°C)"
                : currentStep === 1
                ? "Liquid: Water (~50°C)"
                : "Gas: Steam (100°C+)"}
            </div>
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
            }}
          >
            {currentStep === 0 ? "🧊" : currentStep === 1 ? "💧" : "💨"}
          </div>
        </div>
      </div>

      {/* RIGHT CONTAINER: Microscopic Zoom (Particle Motion) */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 930,
          width: 910,
          height: 840,
          backgroundColor: "#FFFFFF",
          borderRadius: 32,
          boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.07)",
          border: "2px solid #E2E8F0",
          padding: 40,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Card Title */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                backgroundColor: "#7C3AED",
              }}
            />
            <h2 style={{ fontSize: 36, fontWeight: 800, margin: 0 }}>
              Molecular Zoom: Inside the Particles
            </h2>
          </div>
          <span
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#64748B",
              backgroundColor: "#F1F5F9",
              padding: "6px 16px",
              borderRadius: 12,
            }}
          >
            x 5,000,000 ZOOM
          </span>
        </div>

        {/* Circular Magnifying Particle Lens */}
        <div
          style={{
            position: "relative",
            width: 440,
            height: 440,
            margin: "0 auto",
            borderRadius: "50%",
            backgroundColor: "#0F172A",
            border: "12px solid #E2E8F0",
            boxShadow:
              "inset 0 10px 30px rgba(0,0,0,0.6), 0 12px 30px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Target Reticle Lines */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
            }}
          />

          {/* SVG Particles */}
          <svg
            width="440"
            height="440"
            viewBox="-220 -220 440 440"
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <defs>
              <radialGradient id="particle3D" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#93C5FD" />
                <stop offset="60%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1E3A8A" />
              </radialGradient>
              <radialGradient id="particleGas3D" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#C4B5FD" />
                <stop offset="60%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#4C1D95" />
              </radialGradient>
            </defs>

            {particles.map((p) => {
              // 1. Solid Position: tightly packed in regular lattice, high-frequency tiny vibration
              const vibX = Math.sin(frame * 0.9 + p.phase * 3.5) * 3.5;
              const vibY = Math.cos(frame * 0.9 + p.phase * 2.8) * 3.5;
              const xS = p.gx + vibX;
              const yS = p.gy + vibY;

              // 2. Liquid Position: sliding smoothly past each other, settled lower
              const fluidX =
                p.gx * 1.55 +
                Math.sin(frame * 0.12 + p.phase) * 35 +
                Math.cos(frame * 0.08 + p.id) * 18;
              const fluidY =
                p.gy * 0.6 +
                50 +
                Math.cos(frame * 0.15 + p.phase * 2) * 22;

              // 3. Gas Position: fast motion, spread far apart across entire lens
              const gasRadius = 145 + ((p.id * 19) % 45);
              const speedDir = p.id % 2 === 0 ? 1 : -1;
              const gasAngle = frame * 0.18 * speedDir + p.phase * 3;
              const gasX = Math.cos(gasAngle) * gasRadius * 0.88;
              const gasY = Math.sin(gasAngle * 1.2) * gasRadius * 0.88;

              // Blended positions based on state transition weights
              const posX = xS * solidWeight + fluidX * liquidWeight + gasX * gasWeight;
              const posY = yS * solidWeight + fluidY * liquidWeight + gasY * gasWeight;

              return (
                <g key={p.id} transform={`translate(${posX}, ${posY})`}>
                  {/* Motion trails for Gas */}
                  {gasWeight > 0.3 && (
                    <circle
                      r="16"
                      fill="none"
                      stroke="#A78BFA"
                      strokeWidth="2"
                      opacity={gasWeight * 0.4}
                      transform={`scale(${1 + Math.sin(frame * 0.3) * 0.2})`}
                    />
                  )}
                  {/* Particle Sphere */}
                  <circle
                    r="19"
                    fill={gasWeight > 0.5 ? "url(#particleGas3D)" : "url(#particle3D)"}
                    filter="drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* State Explanation Bullet Cards */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {currentStep === 0 && (
            <>
              <div
                style={{
                  backgroundColor: "#F0F9FF",
                  borderLeft: "8px solid #0284C7",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0369A1" }}>
                  Arrangement: Tightly Packed
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  Particles are locked in a fixed pattern and vibrate in place.
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#F0F9FF",
                  borderLeft: "8px solid #0284C7",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0369A1" }}>
                  Shape & Volume: Fixed & Rigid
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  Keeps its shape and does not flow.
                </div>
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div
                style={{
                  backgroundColor: "#EFF6FF",
                  borderLeft: "8px solid #2563EB",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1D4ED8" }}>
                  Arrangement: Close, But Flowing
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  Particles can slide past each other smoothly.
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#EFF6FF",
                  borderLeft: "8px solid #2563EB",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1D4ED8" }}>
                  Shape & Volume: Takes Container's Shape
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  Has a definite volume, but flows to fill the bottom.
                </div>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div
                style={{
                  backgroundColor: "#FAF5FF",
                  borderLeft: "8px solid #7C3AED",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#6D28D9" }}>
                  Arrangement: Far Apart & Fast
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  Particles zoom quickly in all directions with lots of space.
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#FAF5FF",
                  borderLeft: "8px solid #7C3AED",
                  padding: "16px 20px",
                  borderRadius: 14,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 800, color: "#6D28D9" }}>
                  Shape & Volume: Expands Completely
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: "#334155" }}>
                  No fixed shape or volume; spreads out everywhere.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* INTRO CARD OVERLAY (Frames 0 - 72) */}
      {introOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#FFFFFF",
            opacity: introOpacity,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: "8px 24px",
              borderRadius: 20,
              backgroundColor: "#E0F2FE",
              color: "#0284C7",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 20,
            }}
          >
            CLASS 6 SCIENCE
          </div>
          <h1
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: "#0F172A",
              margin: "0 0 16px 0",
              textAlign: "center",
            }}
          >
            The Three States of Matter
          </h1>
          <p
            style={{
              fontSize: 42,
              color: "#64748B",
              fontWeight: 600,
              margin: "0 0 50px 0",
            }}
          >
            Solid • Liquid • Gas
          </p>

          {/* Three Icons Preview */}
          <div style={{ display: "flex", gap: 50 }}>
            {[
              { title: "SOLID", desc: "Ice Cube", icon: "🧊", color: "#0284C7" },
              { title: "LIQUID", desc: "Water", icon: "💧", color: "#2563EB" },
              { title: "GAS", desc: "Steam", icon: "💨", color: "#7C3AED" },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  width: 260,
                  padding: 30,
                  backgroundColor: "#F8FAFC",
                  border: `3px solid ${card.color}`,
                  borderRadius: 24,
                  textAlign: "center",
                  boxShadow: "0 15px 30px rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontSize: 72, marginBottom: 12 }}>{card.icon}</div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: card.color,
                    marginBottom: 6,
                  }}
                >
                  {card.title}
                </div>
                <div style={{ fontSize: 24, color: "#64748B", fontWeight: 600 }}>
                  {card.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUMMARY CARD OVERLAY (Frames 520 - 600) */}
      {summaryOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#FFFFFF",
            opacity: summaryOpacity,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 100,
            padding: 80,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              padding: "8px 24px",
              borderRadius: 20,
              backgroundColor: "#FEF3C7",
              color: "#D97706",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            LESSON RECAP
          </div>
          <h1
            style={{
              fontSize: 76,
              fontWeight: 900,
              color: "#0F172A",
              margin: "0 0 40px 0",
            }}
          >
            What Did We Learn?
          </h1>

          {/* 3 Columns Comparison */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 32,
              width: "100%",
              maxWidth: 1600,
            }}
          >
            {[
              {
                title: "SOLID (Ice)",
                icon: "🧊",
                point1: "Particles packed tightly",
                point2: "Vibrate in fixed spots",
                point3: "Fixed shape & volume",
                color: "#0284C7",
                bg: "#F0F9FF",
              },
              {
                title: "LIQUID (Water)",
                icon: "💧",
                point1: "Particles close together",
                point2: "Can slide & flow past",
                point3: "Takes shape of container",
                color: "#2563EB",
                bg: "#EFF6FF",
              },
              {
                title: "GAS (Steam)",
                icon: "💨",
                point1: "Particles far apart",
                point2: "Move fast in all directions",
                point3: "Fills the entire space",
                color: "#7C3AED",
                bg: "#FAF5FF",
              },
            ].map((col, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: col.bg,
                  border: `3px solid ${col.color}`,
                  borderRadius: 24,
                  padding: 36,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 64, marginBottom: 12 }}>{col.icon}</div>
                <h3
                  style={{
                    fontSize: 38,
                    fontWeight: 900,
                    color: col.color,
                    margin: "0 0 24px 0",
                  }}
                >
                  {col.title}
                </h3>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    width: "100%",
                  }}
                >
                  {[col.point1, col.point2, col.point3].map((pt, pIdx) => (
                    <li
                      key={pIdx}
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: "#334155",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ color: col.color }}>✔</span> {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Big Golden Takeaway Rule */}
          <div
            style={{
              marginTop: 44,
              backgroundColor: "#FFFBEB",
              border: "3px dashed #F59E0B",
              borderRadius: 20,
              padding: "20px 48px",
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            <span style={{ fontSize: 44 }}>🔥</span>
            <span style={{ fontSize: 32, fontWeight: 800, color: "#92400E" }}>
              Heating adds energy, making particles move faster and spread farther apart!
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};