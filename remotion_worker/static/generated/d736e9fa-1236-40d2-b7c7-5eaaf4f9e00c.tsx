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

  // --- STAGES TIMING (Total: 800 frames @ 20fps = 40s) ---
  // 0-100: Intro & Plant reveal (0-5s)
  // 100-240: Step 1: Sunlight Energy (5-12s)
  // 240-380: Step 2: Water from Roots (12-19s)
  // 380-520: Step 3: Carbon Dioxide from Air (19-26s)
  // 520-640: Step 4: Making Glucose & Oxygen (26-32s)
  // 640-800: The Master Equation & Summary (32-40s)

  // Title Banner animation
  const titleOpacity = interpolate(frame, [0, 20, 80, 105], [0, 1, 1, 0.15], {
    extrapolateRight: "clamp",
  });
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Sun Ray animation
  const sunPulse = Math.sin(frame / 6) * 0.08 + 1;
  const rayRotation = frame * 0.8;
  const sunBeamOpacity = interpolate(frame, [100, 130, 240, 260], [0, 0.85, 0.85, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Root Water movement (loops across Step 2 and continues softly)
  const waterCycle1 = ((frame - 240) % 50) / 50;
  const waterCycle2 = ((frame - 260) % 50) / 50;
  const waterCycle3 = ((frame - 275) % 50) / 50;
  const waterActive = frame >= 240;

  // CO2 movement (drifting from right into the main leaf)
  const co2Cycle1 = ((frame - 380) % 60) / 60;
  const co2Cycle2 = ((frame - 410) % 60) / 60;
  const co2Active = frame >= 380;

  // Leaf glow & oxygen bubbling out (Step 4)
  const leafGlow = interpolate(
    frame,
    [520, 560, 640, 680],
    [0, 1, 1, 0.3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const o2Cycle1 = ((frame - 540) % 55) / 55;
  const o2Cycle2 = ((frame - 570) % 55) / 55;
  const oxygenActive = frame >= 540;

  // Active step badge info
  let currentStep = "";
  let stepColor = "#3b82f6";
  let stepOpacity = 0;

  if (frame >= 100 && frame < 240) {
    currentStep = "☀️ Step 1: Leaves absorb Sunlight for energy";
    stepColor = "#eab308";
    stepOpacity = interpolate(frame, [100, 115, 225, 240], [0, 1, 1, 0]);
  } else if (frame >= 240 && frame < 380) {
    currentStep = "💧 Step 2: Roots absorb Water (H₂O) from soil";
    stepColor = "#0284c7";
    stepOpacity = interpolate(frame, [240, 255, 365, 380], [0, 1, 1, 0]);
  } else if (frame >= 380 && frame < 520) {
    currentStep = "💨 Step 3: Carbon Dioxide (CO₂) enters through tiny pores";
    stepColor = "#7c3aed";
    stepOpacity = interpolate(frame, [380, 395, 505, 520], [0, 1, 1, 0]);
  } else if (frame >= 520 && frame < 640) {
    currentStep = "🍃 Step 4: Plant produces Glucose (Food) and Oxygen (O₂)";
    stepColor = "#16a34a";
    stepOpacity = interpolate(frame, [520, 535, 625, 640], [0, 1, 1, 0]);
  }

  // Final Equation card spring
  const equationProgress = spring({
    frame: frame - 640,
    fps,
    config: { damping: 13, stiffness: 85 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#e0f2fe",
        fontFamily: "'system-ui', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* SKY BACKGROUND & SOIL */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="100%" stopColor="#f0fdf4" />
          </linearGradient>
          <linearGradient id="soilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#854d0e" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="sunGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Sky */}
        <rect x="0" y="0" width="1920" height="740" fill="url(#skyGrad)" />

        {/* Soil Base */}
        <rect x="0" y="740" width="1920" height="340" fill="url(#soilGrad)" />
        {/* Soil Grass strip */}
        <path
          d="M 0,740 Q 240,730 480,740 T 960,735 T 1440,740 T 1920,735 L 1920,760 L 0,760 Z"
          fill="#4ade80"
        />

        {/* Underground Root label */}
        <text
          x="300"
          y="880"
          fill="#fef08a"
          fontSize="36"
          fontWeight="bold"
          opacity={frame > 220 ? 0.9 : 0.2}
        >
          Underground Roots (Soil)
        </text>

        {/* ================= SUN ================= */}
        <g transform="translate(240, 180)">
          {/* Animated Sun Rays */}
          <g
            style={{
              transform: `rotate(${rayRotation}deg)`,
              transformOrigin: "0px 0px",
            }}
          >
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
              <line
                key={i}
                x1={Math.cos((angle * Math.PI) / 180) * 110}
                y1={Math.sin((angle * Math.PI) / 180) * 110}
                x2={Math.cos((angle * Math.PI) / 180) * 145}
                y2={Math.sin((angle * Math.PI) / 180) * 145}
                stroke="#f59e0b"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.8"
              />
            ))}
          </g>

          {/* Sun Body */}
          <circle
            cx="0"
            cy="0"
            r={88 * sunPulse}
            fill="url(#sunGrad)"
            stroke="#fbbf24"
            strokeWidth="6"
            filter="url(#glow)"
          />

          {/* Sun Cute Face */}
          <ellipse cx="-26" cy="-12" rx="9" ry="12" fill="#78350f" />
          <ellipse cx="26" cy="-12" rx="9" ry="12" fill="#78350f" />
          <circle cx="-23" cy="-15" r="3" fill="#ffffff" />
          <circle cx="29" cy="-15" r="3" fill="#ffffff" />
          <path
            d="M -22,22 Q 0,40 22,22"
            fill="none"
            stroke="#78350f"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <ellipse cx="-40" cy="8" rx="8" ry="6" fill="#f87171" opacity="0.6" />
          <ellipse cx="40" cy="8" rx="8" ry="6" fill="#f87171" opacity="0.6" />
        </g>

        {/* Sunlight Beams hitting plant */}
        {sunBeamOpacity > 0 && (
          <g opacity={sunBeamOpacity}>
            <polygon
              points="290,230 330,260 760,490 680,520"
              fill="#fef08a"
              opacity="0.35"
            />
            <polygon
              points="300,210 340,230 920,440 850,470"
              fill="#fde047"
              opacity="0.25"
            />
            <line
              x1="320"
              y1="230"
              x2="780"
              y2="490"
              stroke="#fbbf24"
              strokeWidth="4"
              strokeDasharray="14 10"
            />
            <line
              x1="340"
              y1="250"
              x2="880"
              y2="440"
              stroke="#fbbf24"
              strokeWidth="4"
              strokeDasharray="14 10"
            />
          </g>
        )}

        {/* ================= PLANT ================= */}
        {/* Roots */}
        <g stroke="#d97706" strokeWidth="8" strokeLinecap="round" fill="none">
          <path d="M 880,740 Q 860,820 810,910 Q 780,950 730,980" />
          <path d="M 880,740 Q 900,830 950,900 Q 990,950 1060,990" />
          <path d="M 880,770 Q 850,840 860,940" />
          <path d="M 840,840 Q 770,870 720,890" strokeWidth="6" />
          <path d="M 910,830 Q 970,860 1020,880" strokeWidth="6" />
          <path d="M 865,900 Q 820,930 790,960" strokeWidth="5" />
        </g>

        {/* Main Stem */}
        <path
          d="M 880,740 Q 875,560 885,340"
          stroke="#15803d"
          strokeWidth="28"
          strokeLinecap="round"
          fill="none"
        />

        {/* Left Small Leaf */}
        <path
          d="M 875,600 C 720,620 670,550 630,500 C 730,470 820,530 875,570 Z"
          fill="url(#leafGrad)"
          stroke="#166534"
          strokeWidth="4"
        />
        {/* Left Leaf Vein */}
        <path
          d="M 875,570 Q 750,535 630,500"
          stroke="#86efac"
          strokeWidth="4"
          fill="none"
        />

        {/* Right Small Leaf */}
        <path
          d="M 885,540 C 1000,530 1090,460 1140,430 C 1060,390 950,440 885,510 Z"
          fill="url(#leafGrad)"
          stroke="#166534"
          strokeWidth="4"
        />
        <path
          d="M 885,510 Q 1010,470 1140,430"
          stroke="#86efac"
          strokeWidth="4"
          fill="none"
        />

        {/* MAIN BIG FEATURE LEAF (Left-Center, where the action happens) */}
        <g
          filter={leafGlow > 0.1 ? "url(#glow)" : undefined}
          style={{
            transform: `scale(${1 + leafGlow * 0.04})`,
            transformOrigin: "780px 480px",
          }}
        >
          {/* Big Leaf Body */}
          <path
            d="M 880,470 C 710,430 560,360 480,440 C 470,520 600,600 750,570 C 830,550 870,500 880,470 Z"
            fill="url(#leafGrad)"
            stroke={leafGlow > 0.3 ? "#fef08a" : "#166534"}
            strokeWidth={leafGlow > 0.3 ? 7 : 5}
          />
          {/* Main Leaf Veins */}
          <path
            d="M 880,470 Q 670,490 480,440"
            stroke="#86efac"
            strokeWidth="5"
            fill="none"
          />
          <path
            d="M 740,480 Q 720,440 680,420"
            stroke="#86efac"
            strokeWidth="3.5"
            fill="none"
          />
          <path
            d="M 680,485 Q 660,535 630,550"
            stroke="#86efac"
            strokeWidth="3.5"
            fill="none"
          />
          <path
            d="M 600,465 Q 580,430 550,420"
            stroke="#86efac"
            strokeWidth="3.5"
            fill="none"
          />
        </g>

        {/* Top Flower / Bud decoration */}
        <circle cx="885" cy="325" r="28" fill="#ec4899" />
        <circle cx="860" cy="315" r="22" fill="#f43f5e" />
        <circle cx="910" cy="315" r="22" fill="#f43f5e" />
        <circle cx="885" cy="295" r="22" fill="#fb7185" />
        <circle cx="885" cy="325" r="14" fill="#fef08a" />

        {/* ================= FLOWING PARTICLES ================= */}

        {/* 1. Water Droplets traveling up from roots */}
        {waterActive && (
          <g>
            {/* Droplet 1 */}
            <circle
              cx={interpolate(waterCycle1, [0, 0.4, 0.8, 1], [740, 840, 880, 780])}
              cy={interpolate(waterCycle1, [0, 0.4, 0.8, 1], [970, 830, 600, 480])}
              r="13"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="3"
            />
            {/* Droplet 2 */}
            <circle
              cx={interpolate(waterCycle2, [0, 0.4, 0.8, 1], [980, 890, 880, 720])}
              cy={interpolate(waterCycle2, [0, 0.4, 0.8, 1], [940, 820, 580, 490])}
              r="11"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="3"
            />
            {/* Droplet 3 */}
            <circle
              cx={interpolate(waterCycle3, [0, 0.5, 1], [860, 880, 660])}
              cy={interpolate(waterCycle3, [0, 0.5, 1], [910, 670, 500])}
              r="10"
              fill="#0ea5e9"
              stroke="#ffffff"
              strokeWidth="2.5"
            />
          </g>
        )}

        {/* 2. CO2 molecules entering leaf */}
        {co2Active && (
          <g>
            {/* CO2 Particle 1 */}
            <g
              transform={`translate(${interpolate(
                co2Cycle1,
                [0, 1],
                [1100, 760]
              )}, ${interpolate(co2Cycle1, [0, 1], [330, 470])})`}
            >
              <circle r="22" fill="#6366f1" stroke="#ffffff" strokeWidth="3" />
              <text
                x="0"
                y="8"
                fill="#ffffff"
                fontSize="16"
                fontWeight="900"
                textAnchor="middle"
              >
                CO₂
              </text>
            </g>
            {/* CO2 Particle 2 */}
            <g
              transform={`translate(${interpolate(
                co2Cycle2,
                [0, 1],
                [1180, 820]
              )}, ${interpolate(co2Cycle2, [0, 1], [400, 510])})`}
            >
              <circle r="20" fill="#4f46e5" stroke="#ffffff" strokeWidth="3" />
              <text
                x="0"
                y="7"
                fill="#ffffff"
                fontSize="15"
                fontWeight="900"
                textAnchor="middle"
              >
                CO₂
              </text>
            </g>
          </g>
        )}

        {/* 3. Oxygen (O2) bubbles floating out into air */}
        {oxygenActive && (
          <g>
            {/* O2 Bubble 1 */}
            <g
              transform={`translate(${interpolate(
                o2Cycle1,
                [0, 1],
                [620, 480]
              )}, ${interpolate(o2Cycle1, [0, 1], [470, 270])})`}
            >
              <circle
                r="24"
                fill="#06b6d4"
                opacity="0.9"
                stroke="#ffffff"
                strokeWidth="3.5"
              />
              <text
                x="0"
                y="9"
                fill="#ffffff"
                fontSize="18"
                fontWeight="bold"
                textAnchor="middle"
              >
                O₂
              </text>
            </g>
            {/* O2 Bubble 2 */}
            <g
              transform={`translate(${interpolate(
                o2Cycle2,
                [0, 1],
                [560, 410]
              )}, ${interpolate(o2Cycle2, [0, 1], [450, 210])})`}
            >
              <circle
                r="22"
                fill="#22d3ee"
                opacity="0.9"
                stroke="#ffffff"
                strokeWidth="3"
              />
              <text
                x="0"
                y="8"
                fill="#ffffff"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
              >
                O₂
              </text>
            </g>
          </g>
        )}

        {/* Glucose Food Indicator inside Leaf */}
        {frame >= 530 && (
          <g
            transform="translate(680, 510)"
            opacity={interpolate(frame, [530, 550], [0, 1], {
              extrapolateRight: "clamp",
            })}
          >
            <polygon
              points="0,-24 22,-12 22,12 0,24 -22,12 -22,-12"
              fill="#eab308"
              stroke="#ffffff"
              strokeWidth="3"
            />
            <text
              x="0"
              y="6"
              fill="#713f12"
              fontSize="14"
              fontWeight="900"
              textAnchor="middle"
            >
              GLUCOSE
            </text>
          </g>
        )}
      </svg>

      {/* ================= STATIC LABELS & POINTERS ================= */}

      {/* Sun Label Card */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 360,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: "10px 24px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          border: "4px solid #f59e0b",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <span style={{ fontSize: 32 }}>☀️</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: "#b45309" }}>
          Light Energy (Sunlight)
        </span>
      </div>

      {/* Water Label Card */}
      <div
        style={{
          position: "absolute",
          top: 860,
          left: 1120,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: "10px 24px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
          border: "4px solid #0284c7",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(frame, [220, 245], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <span style={{ fontSize: 32 }}>💧</span>
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#0369a1" }}>
            Water (H₂O)
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#0284c7" }}>
            Absorbed through roots
          </div>
        </div>
      </div>

      {/* Carbon Dioxide Label Card */}
      <div
        style={{
          position: "absolute",
          top: 360,
          left: 1240,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: "12px 26px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          border: "4px solid #6366f1",
          opacity: interpolate(frame, [360, 385], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 800, color: "#4338ca" }}>
          💨 Carbon Dioxide (CO₂)
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#4f46e5" }}>
          Enters leaf from air
        </div>
      </div>

      {/* Oxygen & Glucose Produced Labels */}
      {frame >= 520 && (
        <>
          {/* Oxygen Tag */}
          <div
            style={{
              position: "absolute",
              top: 240,
              left: 280,
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "10px 24px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.14)",
              border: "4px solid #06b6d4",
              opacity: interpolate(frame, [520, 545], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 800, color: "#0891b2" }}>
              🫧 Oxygen (O₂) Released!
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#0e7490" }}>
              Clean air for us to breathe
            </div>
          </div>

          {/* Glucose Tag */}
          <div
            style={{
              position: "absolute",
              top: 610,
              left: 480,
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: "10px 24px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.14)",
              border: "4px solid #eab308",
              opacity: interpolate(frame, [540, 565], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: "#a16207" }}>
              🍯 Glucose (C₆H₁₂O₆)
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#854d0e" }}>
              Stored food for plant growth
            </div>
          </div>
        </>
      )}

      {/* ================= STEP BANNER (TOP CENTER) ================= */}
      {stepOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#ffffff",
            padding: "16px 42px",
            borderRadius: 60,
            boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
            border: `5px solid ${stepColor}`,
            opacity: stepOpacity,
            zIndex: 30,
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: stepColor,
              letterSpacing: "0.5px",
            }}
          >
            {currentStep}
          </span>
        </div>
      )}

      {/* ================= INTRO TITLE (0 - 5 seconds) ================= */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pointerEvents: "none",
          opacity: titleOpacity,
          transform: `scale(${titleScale})`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "18px 50px",
            borderRadius: 40,
            boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
            border: "5px solid #22c55e",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 900, color: "#15803d" }}>
            🌱 How Photosynthesis Works 🌱
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#475569", marginTop: 4 }}>
            Class 7 Science • How Plants Make Their Own Food
          </div>
        </div>
      </div>

      {/* ================= FINAL MASTER EQUATION CARD (32s - 40s) ================= */}
      {frame >= 635 && (
        <div
          style={{
            position: "absolute",
            bottom: 45,
            left: "50%",
            transform: `translateX(-50%) translateY(${(1 - equationProgress) * 160}px)`,
            width: 1720,
            backgroundColor: "#ffffff",
            borderRadius: 32,
            padding: "26px 40px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            border: "6px solid #15803d",
            zIndex: 50,
            opacity: equationProgress,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              borderBottom: "3px solid #e2e8f0",
              paddingBottom: 10,
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 900, color: "#15803d" }}>
              🧪 The Photosynthesis Chemical Equation
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                backgroundColor: "#dcfce7",
                color: "#166534",
                padding: "6px 20px",
                borderRadius: 20,
              }}
            >
              Summary for Class 7
            </div>
          </div>

          {/* Equation Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              backgroundColor: "#f8fafc",
              padding: "16px 24px",
              borderRadius: 24,
            }}
          >
            {/* Reactant 1: Carbon Dioxide */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#4f46e5" }}>
                6CO₂
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1" }}>
                Carbon Dioxide
              </div>
              <div style={{ fontSize: 17, color: "#64748b" }}>(From Air)</div>
            </div>

            <div style={{ fontSize: 46, fontWeight: 900, color: "#64748b" }}>+</div>

            {/* Reactant 2: Water */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#0284c7" }}>
                6H₂O
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0369a1" }}>
                Water
              </div>
              <div style={{ fontSize: 17, color: "#64748b" }}>(From Roots)</div>
            </div>

            {/* Catalyst Arrow with Sunlight & Chlorophyll */}
            <div style={{ textAlign: "center", minWidth: 240 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706" }}>
                ☀️ Sunlight
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#16a34a", lineHeight: 0.9 }}>
                ────────▶
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#15803d" }}>
                🍃 Chlorophyll
              </div>
            </div>

            {/* Product 1: Glucose */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#d97706" }}>
                C₆H₁₂O₆
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#b45309" }}>
                Glucose (Sugar)
              </div>
              <div style={{ fontSize: 17, color: "#64748b" }}>(Plant Food)</div>
            </div>

            <div style={{ fontSize: 46, fontWeight: 900, color: "#64748b" }}>+</div>

            {/* Product 2: Oxygen */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: "#06b6d4" }}>
                6O₂
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0891b2" }}>
                Oxygen Gas
              </div>
              <div style={{ fontSize: 17, color: "#64748b" }}>(Released to Air)</div>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};