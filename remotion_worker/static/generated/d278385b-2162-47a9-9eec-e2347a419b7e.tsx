import React from "react";
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

  // ----------------------------------------------------
  // Timings (total 1200 frames @ 30fps = 40s)
  // ----------------------------------------------------
  // Intro: 0 - 150 (0 - 5s)
  // Step 1 - Sunlight: 150 - 390 (5s - 13s)
  // Step 2 - Water: 390 - 630 (13s - 21s)
  // Step 3 - CO2: 630 - 870 (21s - 29s)
  // Step 4 - Glucose & O2: 870 - 1050 (29s - 35s)
  // Step 5 - Chemical Equation Summary: 1050 - 1200 (35s - 40s)

  // Current active step calculation
  const currentStep =
    frame < 150
      ? 0
      : frame < 390
      ? 1
      : frame < 630
      ? 2
      : frame < 870
      ? 3
      : frame < 1050
      ? 4
      : 5;

  // Sun rotation & ray pulses
  const sunRotation = (frame * 0.5) % 360;
  const sunPulse = 1 + Math.sin(frame * 0.08) * 0.04;

  // Plant growth / entrance spring
  const plantEntrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 60 },
  });

  // Flow animation helper loop (0 to 1)
  const loop0to1 = (period: number, offset = 0) =>
    ((frame + offset) % period) / period;

  // Header Title details
  const stepInfo = [
    {
      title: "🌱 How Photosynthesis Works",
      subtitle: "The magical process plants use to make food!",
      badgeBg: "#10b981",
    },
    {
      title: "☀️ Step 1: Absorbing Sunlight",
      subtitle: "Green chlorophyll inside the leaves traps solar light energy",
      badgeBg: "#f59e0b",
    },
    {
      title: "💧 Step 2: Drawing Water (H₂O)",
      subtitle: "Roots absorb moisture from soil and pump it up through the stem",
      badgeBg: "#0284c7",
    },
    {
      title: "💨 Step 3: Breathing Carbon Dioxide (CO₂)",
      subtitle: "Leaves take in CO₂ from the air through microscopic stomata",
      badgeBg: "#8b5cf6",
    },
    {
      title: "✨ Step 4: Making Food & Oxygen!",
      subtitle: "Solar energy turns H₂O + CO₂ into sweet Glucose and fresh Oxygen",
      badgeBg: "#059669",
    },
    {
      title: "🧪 The Photosynthesis Equation",
      subtitle: "Balanced chemical formula for Class 7 Science",
      badgeBg: "#dc2626",
    },
  ][currentStep];

  // Leaf glow during reaction phase (Step 4 & 5)
  const leafGlow =
    frame >= 870
      ? 0.5 + 0.5 * Math.sin((frame - 870) * 0.15)
      : frame >= 630
      ? 0.2
      : 0;

  return (
    <AbsoluteFill
      style={{
        width: 1920,
        height: 1080,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
        backgroundColor: "#e0f2fe",
      }}
    >
      {/* ================= SKY BACKGROUND ================= */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 740,
          background:
            "linear-gradient(180deg, #7dd3fc 0%, #bae6fd 60%, #e0f2fe 100%)",
        }}
      />

      {/* Floating Gentle Clouds */}
      <svg
        style={{
          position: "absolute",
          top: 80,
          left: ((frame * 0.6) % 2100) - 200,
          opacity: 0.7,
        }}
        width="180"
        height="80"
        viewBox="0 0 180 80"
      >
        <path
          d="M30 60 A25 25 0 0 1 70 35 A35 35 0 0 1 130 35 A25 25 0 0 1 165 60 Z"
          fill="#ffffff"
        />
      </svg>

      <svg
        style={{
          position: "absolute",
          top: 130,
          left: (((frame * 0.4) + 800) % 2100) - 200,
          opacity: 0.5,
        }}
        width="220"
        height="90"
        viewBox="0 0 180 80"
      >
        <path
          d="M30 60 A25 25 0 0 1 70 35 A35 35 0 0 1 130 35 A25 25 0 0 1 165 60 Z"
          fill="#ffffff"
        />
      </svg>

      {/* ================= SOIL / GROUND SECTION ================= */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 340,
          background:
            "linear-gradient(180deg, #5c3c1e 0%, #3e2712 40%, #2b1809 100%)",
          borderTop: "16px solid #4ade80",
        }}
      >
        {/* Soil specks / texture */}
        {[
          { x: 180, y: 80 },
          { x: 340, y: 190 },
          { x: 550, y: 100 },
          { x: 740, y: 220 },
          { x: 1200, y: 140 },
          { x: 1450, y: 240 },
          { x: 1680, y: 90 },
        ].map((pt, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pt.x,
              top: pt.y,
              width: 14,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
        ))}

        {/* Underground Soil Label */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 50,
            color: "#d7ba89",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            opacity: 0.6,
          }}
        >
          Underground Soil (Moisture & Minerals)
        </div>
      </div>

      {/* ================= SUN (Top Left) ================= */}
      <div
        style={{
          position: "absolute",
          left: 180,
          top: 150,
          width: 180,
          height: 180,
          transform: `scale(${sunPulse})`,
          transformOrigin: "center center",
        }}
      >
        {/* Rotating Sun Rays */}
        <svg
          width="180"
          height="180"
          viewBox="0 0 200 200"
          style={{
            transform: `rotate(${sunRotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(
            (angle) => (
              <line
                key={angle}
                x1="100"
                y1="10"
                x2="100"
                y2="30"
                stroke="#fbbf24"
                strokeWidth="8"
                strokeLinecap="round"
                transform={`rotate(${angle} 100 100)`}
              />
            )
          )}
        </svg>

        {/* Sun Core with Happy Face */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            top: 30,
            left: 30,
          }}
        >
          <circle cx="50" cy="50" r="46" fill="#f59e0b" />
          <circle cx="50" cy="50" r="40" fill="#fbbf24" />
          {/* Eyes */}
          <circle cx="38" cy="44" r="5" fill="#78350f" />
          <circle cx="62" cy="44" r="5" fill="#78350f" />
          {/* Smile */}
          <path
            d="M 36 58 Q 50 72 64 58"
            stroke="#78350f"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Rosy Cheeks */}
          <circle cx="29" cy="54" r="4" fill="#f87171" opacity="0.6" />
          <circle cx="71" cy="54" r="4" fill="#f87171" opacity="0.6" />
        </svg>
      </div>

      {/* ================= PLANT WITH ROOTS & BIG LEAF ================= */}
      <svg
        width="1920"
        height="1080"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          transformOrigin: "960px 740px",
          transform: `scale(${plantEntrance})`,
        }}
      >
        <defs>
          <linearGradient id="stemGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>

          <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="60%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>

          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- ROOTS (Below Ground, y >= 740) --- */}
        <g stroke="#a16207" strokeWidth="8" strokeLinecap="round" fill="none">
          {/* Main tap roots */}
          <path d="M 980 740 Q 970 820 950 920 T 930 1010" strokeWidth="12" />
          <path d="M 980 740 Q 1030 830 1080 940 T 1120 1020" strokeWidth="10" />
          <path d="M 980 740 Q 920 800 840 870 T 750 930" strokeWidth="9" />
          <path d="M 980 740 Q 1060 790 1160 850 T 1250 910" strokeWidth="9" />

          {/* Root sub-branches */}
          <path d="M 960 840 Q 900 870 870 940" strokeWidth="6" />
          <path d="M 1040 850 Q 1110 880 1170 960" strokeWidth="6" />
          <path d="M 945 930 Q 900 970 850 995" strokeWidth="5" />
          <path d="M 850 870 Q 800 900 780 970" strokeWidth="5" />
          <path d="M 1080 930 Q 1130 960 1180 1000" strokeWidth="5" />
        </g>

        {/* --- MAIN STEM (Above Ground, y <= 740) --- */}
        <path
          d="M 980 740 Q 975 580 985 380"
          stroke="url(#stemGrad)"
          strokeWidth="24"
          strokeLinecap="round"
          fill="none"
        />

        {/* Top small budding leaves */}
        <path
          d="M 985 380 Q 950 330 930 310 Q 970 320 985 380 Z"
          fill="url(#leafGrad)"
        />
        <path
          d="M 985 380 Q 1020 330 1045 315 Q 1000 325 985 380 Z"
          fill="url(#leafGrad)"
        />

        {/* --- RIGHT LEAF --- */}
        <g>
          {/* Petiole */}
          <path
            d="M 980 580 Q 1060 565 1120 540"
            stroke="#15803d"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Leaf body */}
          <path
            d="M 1120 540 C 1190 470 1340 480 1400 520 C 1340 610 1190 620 1120 540 Z"
            fill="url(#leafGrad)"
            stroke="#166534"
            strokeWidth="4"
          />
          {/* Leaf vein */}
          <path
            d="M 1120 540 Q 1260 530 1390 520"
            stroke="#86efac"
            strokeWidth="4"
            fill="none"
          />
        </g>

        {/* --- MAIN HERO LEFT LEAF (Focus for CO2, Sunlight, O2) --- */}
        <g
          filter={
            leafGlow > 0
              ? `drop-shadow(0 0 ${20 * leafGlow}px rgba(74, 222, 128, 0.9))`
              : undefined
          }
        >
          {/* Leaf stalk */}
          <path
            d="M 980 540 Q 880 520 800 480"
            stroke="#15803d"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          {/* Main Leaf Blade - large, friendly */}
          <path
            d="M 800 480 C 720 380 510 390 420 460 C 500 610 720 620 800 480 Z"
            fill="url(#leafGrad)"
            stroke="#166534"
            strokeWidth="5"
          />
          {/* Central vein */}
          <path
            d="M 800 480 Q 610 470 425 460"
            stroke="#86efac"
            strokeWidth="5"
            fill="none"
          />
          {/* Secondary veins */}
          <path
            d="M 680 475 Q 630 430 580 415"
            stroke="#86efac"
            strokeWidth="3.5"
            fill="none"
          />
          <path
            d="M 680 475 Q 640 520 590 545"
            stroke="#86efac"
            strokeWidth="3.5"
            fill="none"
          />
          <path
            d="M 570 470 Q 530 435 490 425"
            stroke="#86efac"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M 570 470 Q 535 505 495 520"
            stroke="#86efac"
            strokeWidth="3"
            fill="none"
          />
        </g>
      </svg>

      {/* ================= STEP 1: SUNLIGHT RAYS (Frames 150 - 390) ================= */}
      {frame >= 140 && (
        <svg
          width="1920"
          height="1080"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            pointerEvents: "none",
            opacity:
              currentStep === 1
                ? interpolate(frame, [140, 165], [0, 1], {
                    extrapolateRight: "clamp",
                  })
                : 0.35, // Remains subtle in later steps
          }}
        >
          {/* 4 radiant beams from sun down to main leaf */}
          {[
            { x1: 270, y1: 230, x2: 560, y2: 430 },
            { x1: 300, y1: 250, x2: 630, y2: 450 },
            { x1: 330, y1: 270, x2: 700, y2: 470 },
          ].map((beam, idx) => {
            const dashOffset = -((frame * 4 + idx * 25) % 80);
            return (
              <line
                key={idx}
                x1={beam.x1}
                y1={beam.y1}
                x2={beam.x2}
                y2={beam.y2}
                stroke="#f59e0b"
                strokeWidth="10"
                strokeDasharray="24 16"
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                opacity="0.8"
              />
            );
          })}
        </svg>
      )}

      {/* Sunlight Floating Badge (Step 1) */}
      {frame >= 160 && currentStep <= 2 && (
        <div
          style={{
            position: "absolute",
            left: 360,
            top: 310,
            backgroundColor: "#fef3c7",
            border: "4px solid #f59e0b",
            borderRadius: 24,
            padding: "10px 22px",
            boxShadow: "0 8px 24px rgba(245, 158, 11, 0.3)",
            opacity: interpolate(frame, [160, 180], [0, 1], {
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${Math.sin(frame * 0.08) * 6}px)`,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, color: "#b45309" }}>
            ☀️ Light Energy (Sunlight)
          </span>
        </div>
      )}

      {/* ================= STEP 2: WATER FROM ROOTS (Frames 390 - 630) ================= */}
      {/* Animated blue water droplets moving up from soil through roots to stem & leaf */}
      {frame >= 380 && (
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          {/* Several droplets along the root and stem paths */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            // progress repeats every 45 frames, staggered
            const p = loop0to1(45, i * 8);

            // Path 1: Soil (850, 950) -> Taproot (970, 740) -> Stem (980, 540) -> Leaf (660, 480)
            let x = 0;
            let y = 0;
            if (p < 0.4) {
              // moving up roots to ground level
              const localP = p / 0.4;
              x = interpolate(localP, [0, 1], [820 + (i % 3) * 60, 980]);
              y = interpolate(localP, [0, 1], [980 - (i % 2) * 50, 740]);
            } else if (p < 0.75) {
              // climbing the stem
              const localP = (p - 0.4) / 0.35;
              x = interpolate(localP, [0, 1], [980, 980]);
              y = interpolate(localP, [0, 1], [740, 540]);
            } else {
              // branching into the leaf
              const localP = (p - 0.75) / 0.25;
              x = interpolate(localP, [0, 1], [980, 640]);
              y = interpolate(localP, [0, 1], [540, 480]);
            }

            const opacity =
              currentStep === 2
                ? 1
                : currentStep > 2
                ? 0.5 // stays active in background
                : 0;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x - 14,
                  top: y - 14,
                  width: 28,
                  height: 28,
                  borderRadius: "50% 50% 50% 0",
                  backgroundColor: "#38bdf8",
                  border: "3px solid #0284c7",
                  transform: "rotate(-45deg)",
                  opacity,
                  boxShadow: "0 0 10px #38bdf8",
                }}
              />
            );
          })}

          {/* Water Label */}
          {frame >= 400 && currentStep <= 4 && (
            <div
              style={{
                position: "absolute",
                left: 1040,
                top: 790,
                backgroundColor: "#e0f2fe",
                border: "4px solid #0284c7",
                borderRadius: 22,
                padding: "12px 24px",
                boxShadow: "0 8px 24px rgba(2, 132, 199, 0.3)",
                opacity: interpolate(frame, [400, 420], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${Math.sin(frame * 0.1) * 5}px)`,
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: "#0369a1" }}>
                💧 Water (H₂O) absorbed by roots
              </div>
              <div style={{ fontSize: 18, color: "#0c4a6e", marginTop: 2 }}>
                Travels UP through xylem tubes to leaves
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: CARBON DIOXIDE INTO LEAF (Frames 630 - 870) ================= */}
      {frame >= 620 && (
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          {/* CO2 gas molecules floating into leaf from air on left */}
          {[0, 1, 2, 3, 4].map((i) => {
            const p = loop0to1(50, i * 11);
            // moves from left (x: 100 to 560, y: around 440 - 520)
            const startX = 160 + (i % 2) * 50;
            const startY = 380 + i * 40;
            const targetX = 580;
            const targetY = 480;

            const x = interpolate(p, [0, 1], [startX, targetX]);
            const y = interpolate(p, [0, 1], [startY, targetY]);
            const scale = interpolate(p, [0, 0.8, 1], [0.6, 1.1, 0.3]);
            const opacity =
              currentStep === 3
                ? interpolate(p, [0, 0.2, 0.85, 1], [0, 1, 1, 0])
                : currentStep > 3
                ? 0.4
                : 0;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  padding: "8px 14px",
                  borderRadius: 18,
                  backgroundColor: "#ede9fe",
                  border: "3px solid #7c3aed",
                  transform: `scale(${scale})`,
                  opacity,
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#5b21b6",
                    letterSpacing: 1,
                  }}
                >
                  CO₂
                </span>
              </div>
            );
          })}

          {/* CO2 Label */}
          {frame >= 640 && currentStep <= 4 && (
            <div
              style={{
                position: "absolute",
                left: 120,
                top: 550,
                backgroundColor: "#f5f3ff",
                border: "4px solid #7c3aed",
                borderRadius: 22,
                padding: "12px 24px",
                boxShadow: "0 8px 24px rgba(124, 58, 237, 0.25)",
                opacity: interpolate(frame, [640, 660], [0, 1], {
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${Math.sin(frame * 0.09) * 5}px)`,
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: "#6d28d9" }}>
                💨 Carbon Dioxide (CO₂)
              </div>
              <div style={{ fontSize: 18, color: "#4c1d95", marginTop: 2 }}>
                Enters from air through tiny pores (stomata)
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 4: OUTPUTS - GLUCOSE & OXYGEN (Frames 870 - 1050) ================= */}
      {frame >= 860 && (
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          {/* Oxygen (O2) Bubbles floating UP into the atmosphere */}
          {[0, 1, 2, 3, 4].map((i) => {
            const p = loop0to1(45, i * 10);
            const startX = 540 + (i % 3) * 60;
            const startY = 440;
            const targetX = 420 + (i % 2) * 80;
            const targetY = 160 - i * 20;

            const x = interpolate(p, [0, 1], [startX, targetX]);
            const y = interpolate(p, [0, 1], [startY, targetY]);
            const scale = interpolate(p, [0, 0.3, 1], [0.4, 1.1, 0.9]);
            const opacity = interpolate(p, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  padding: "10px 16px",
                  borderRadius: 30,
                  backgroundColor: "#ecfdf5",
                  border: "3px solid #10b981",
                  transform: `scale(${scale})`,
                  opacity: currentStep >= 4 ? opacity : 0,
                  boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#047857",
                  }}
                >
                  O₂ 🍃
                </span>
              </div>
            );
          })}

          {/* Glucose particles storing in stem and leaves */}
          {[0, 1, 2, 3].map((i) => {
            const p = loop0to1(40, i * 12);
            // Move from leaf center into the stem to feed the plant
            const x = interpolate(p, [0, 1], [620, 980 + (i % 2) * 20]);
            const y = interpolate(p, [0, 1], [480, 550 + i * 40]);
            const scale = interpolate(p, [0, 0.5, 1], [0.6, 1.2, 0.8]);

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  padding: "6px 12px",
                  borderRadius: 14,
                  backgroundColor: "#fef08a",
                  border: "3px solid #eab308",
                  transform: `scale(${scale})`,
                  opacity: currentStep >= 4 ? 0.95 : 0,
                  boxShadow: "0 0 14px rgba(234, 179, 8, 0.5)",
                }}
              >
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#854d0e",
                  }}
                >
                  🍯 Sugar (Glucose)
                </span>
              </div>
            );
          })}

          {/* Oxygen Badge */}
          <div
            style={{
              position: "absolute",
              left: 480,
              top: 240,
              backgroundColor: "#ecfdf5",
              border: "4px solid #10b981",
              borderRadius: 22,
              padding: "10px 22px",
              boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)",
              opacity: interpolate(frame, [880, 905], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${Math.sin(frame * 0.08) * 5}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#065f46" }}>
              🍃 Oxygen (O₂) Released!
            </div>
            <div style={{ fontSize: 16, color: "#047857" }}>
              Animals & humans breathe this!
            </div>
          </div>

          {/* Glucose Badge */}
          <div
            style={{
              position: "absolute",
              left: 1040,
              top: 430,
              backgroundColor: "#fef9c3",
              border: "4px solid #eab308",
              borderRadius: 22,
              padding: "10px 22px",
              boxShadow: "0 8px 24px rgba(234, 179, 8, 0.3)",
              opacity: interpolate(frame, [900, 925], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${Math.sin(frame * 0.08 + 1) * 5}px)`,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: "#854d0e" }}>
              🍯 Glucose (C₆H₁₂O₆) Stored!
            </div>
            <div style={{ fontSize: 16, color: "#a16207" }}>
              Delicious food for the plant to grow!
            </div>
          </div>
        </div>
      )}

      {/* ================= TOP HEADER BANNER (Instructions & Steps) ================= */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 50,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            backgroundColor: stepInfo.badgeBg,
            color: "#ffffff",
            padding: "12px 38px",
            borderRadius: 50,
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: 0.5,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            textAlign: "center",
            display: "inline-block",
            transition: "background-color 0.3s",
          }}
        >
          {stepInfo.title}
        </div>
        <div
          style={{
            marginTop: 12,
            backgroundColor: "rgba(255, 255, 255, 0.92)",
            color: "#1e293b",
            padding: "8px 28px",
            borderRadius: 30,
            fontSize: 26,
            fontWeight: 600,
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          {stepInfo.subtitle}
        </div>
      </div>

      {/* ================= STEP 5: FINAL CHEMICAL EQUATION CARD (Frames 1050 - 1200) ================= */}
      {frame >= 1040 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            opacity: interpolate(frame, [1040, 1065], [0, 1], {
              extrapolateRight: "clamp",
            }),
          }}
        >
          {/* Main Formula Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 32,
              padding: "48px 64px",
              maxWidth: 1600,
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              border: "6px solid #22c55e",
              textAlign: "center",
              transform: `scale(${spring({
                frame: frame - 1045,
                fps,
                config: { damping: 14, stiffness: 70 },
              })})`,
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                color: "#15803d",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Class 7 Summary • Chemical Equation
            </div>

            {/* Formula Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                fontSize: 54,
                fontWeight: 900,
                color: "#0f172a",
                margin: "24px 0",
              }}
            >
              {/* Reactant 1: 6CO2 */}
              <div
                style={{
                  backgroundColor: "#ede9fe",
                  border: "4px solid #8b5cf6",
                  padding: "16px 28px",
                  borderRadius: 20,
                  color: "#5b21b6",
                }}
              >
                6CO₂
                <div style={{ fontSize: 20, color: "#6d28d9", fontWeight: 700 }}>
                  Carbon Dioxide
                </div>
              </div>

              <span style={{ fontSize: 48, color: "#64748b" }}>+</span>

              {/* Reactant 2: 6H2O */}
              <div
                style={{
                  backgroundColor: "#e0f2fe",
                  border: "4px solid #0284c7",
                  padding: "16px 28px",
                  borderRadius: 20,
                  color: "#0369a1",
                }}
              >
                6H₂O
                <div style={{ fontSize: 20, color: "#0284c7", fontWeight: 700 }}>
                  Water
                </div>
              </div>

              {/* Arrow with Light & Chlorophyll */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0 14px",
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#d97706",
                    marginBottom: 4,
                  }}
                >
                  ☀️ Sunlight
                </span>
                <span style={{ fontSize: 60, color: "#16a34a", lineHeight: 0.6 }}>
                  ➔
                </span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#15803d",
                    marginTop: 8,
                  }}
                >
                  Chlorophyll
                </span>
              </div>

              {/* Product 1: Glucose */}
              <div
                style={{
                  backgroundColor: "#fef9c3",
                  border: "4px solid #eab308",
                  padding: "16px 28px",
                  borderRadius: 20,
                  color: "#854d0e",
                }}
              >
                C₆H₁₂O₆
                <div style={{ fontSize: 20, color: "#a16207", fontWeight: 700 }}>
                  Glucose (Food)
                </div>
              </div>

              <span style={{ fontSize: 48, color: "#64748b" }}>+</span>

              {/* Product 2: 6O2 */}
              <div
                style={{
                  backgroundColor: "#ecfdf5",
                  border: "4px solid #10b981",
                  padding: "16px 28px",
                  borderRadius: 20,
                  color: "#047857",
                }}
              >
                6O₂
                <div style={{ fontSize: 20, color: "#059669", fontWeight: 700 }}>
                  Oxygen Gas
                </div>
              </div>
            </div>

            {/* Simple Student Takeaway Banner */}
            <div
              style={{
                marginTop: 28,
                fontSize: 26,
                fontWeight: 600,
                color: "#475569",
                backgroundColor: "#f8fafc",
                borderRadius: 16,
                padding: "14px 28px",
              }}
            >
              🌿 Plants feed the living world and give us oxygen to breathe!
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};