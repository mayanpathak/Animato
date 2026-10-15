import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

export const DURATION_SECONDS = 40;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ----------------------------------------------------
  // Timing phases (total 800 frames @ 20 fps)
  // Phase 1 (0-120): Intro & Plant overview
  // Phase 2 (120-280): Step 1 - Water (H2O) & Sunlight
  // Phase 3 (280-440): Step 2 - Carbon Dioxide (CO2)
  // Phase 4 (440-600): Step 3 - Glucose & Oxygen (O2)
  // Phase 5 (600-800): Summary & Chemical Equation
  // ----------------------------------------------------

  // Sun pulsing animation
  const sunPulse = 1 + Math.sin(frame * 0.15) * 0.05;
  const sunRayRotate = frame * 0.8;

  // Water droplets flowing up roots
  const waterFlow = (frame * 6) % 240;

  // CO2 floating towards leaf (phase 3 onwards)
  const co2Progress = interpolate(frame, [280, 360], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Reaction glow on leaf
  const leafGlow =
    frame >= 350 && frame < 600
      ? 0.5 + Math.sin(frame * 0.25) * 0.5
      : 0;

  // Products emerging (phase 4 onwards)
  const productSpring = spring({
    frame: frame - 440,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Equation overlay (phase 5)
  const equationEntrance = spring({
    frame: frame - 600,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Active step badge info
  const stepText = useMemo(() => {
    if (frame < 120) return "Welcome to Photosynthesis! 🌱";
    if (frame < 280) return "Step 1: Roots absorb Water & Leaves catch Sunlight ☀️💧";
    if (frame < 440) return "Step 2: Leaves take in Carbon Dioxide (CO₂) from air 🍃";
    if (frame < 600) return "Step 3: Food (Glucose) & Oxygen (O₂) are made! ✨";
    return "The Chemical Equation of Photosynthesis 🔬";
  }, [frame]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ecfeff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Sky Background Gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 720,
          background: "linear-gradient(180deg, #bae6fd 0%, #e0f2fe 70%, #f0fdf4 100%)",
        }}
      />

      {/* Soil / Ground */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 360,
          backgroundColor: "#78350f",
          borderTop: "14px solid #15803d",
          backgroundImage: "radial-gradient(#92400e 15%, transparent 16%)",
          backgroundSize: "40px 40px",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            fontSize: 52,
            fontWeight: 800,
            color: "#fef3c7",
            letterSpacing: 1,
          }}
        >
          SOIL (Rich in Water & Minerals)
        </div>
      </div>

      {/* Top Banner & Instructions */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 60,
          right: 60,
          height: 120,
          backgroundColor: "#ffffff",
          borderRadius: 24,
          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          border: "5px solid #0284c7",
          zIndex: 40,
        }}
      >
        <span
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: "#0369a1",
          }}
        >
          {stepText}
        </span>
        <div
          style={{
            backgroundColor: "#0284c7",
            color: "#ffffff",
            padding: "8px 24px",
            borderRadius: 16,
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          Class 7 Science
        </div>
      </div>

      {/* Main Diagram Canvas (SVG) */}
      <svg
        width="1920"
        height="1080"
        style={{ position: "absolute", top: 0, left: 0, zIndex: 10 }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ================= SUN (Top Left) ================= */}
        <g transform={`translate(260, 280) scale(${sunPulse})`}>
          {/* Sun Rays */}
          <g transform={`rotate(${sunRayRotate})`}>
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="0"
                y1="-110"
                x2="0"
                y2="-145"
                stroke="#f59e0b"
                strokeWidth="10"
                strokeLinecap="round"
                transform={`rotate(${deg})`}
              />
            ))}
          </g>
          {/* Sun Core */}
          <circle cx="0" cy="0" r="95" fill="#facc15" stroke="#f59e0b" strokeWidth="8" />
          {/* Happy Face for Kids */}
          <circle cx="-30" cy="-15" r="10" fill="#78350f" />
          <circle cx="30" cy="-15" r="10" fill="#78350f" />
          <path
            d="M -35 20 Q 0 55 35 20"
            stroke="#78350f"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Sunlight Beams pointing to Leaf */}
        {frame >= 120 && (
          <g opacity={Math.min(1, (frame - 120) / 30)}>
            <line
              x1="350"
              y1="340"
              x2="730"
              y2="520"
              stroke="#fbbf24"
              strokeWidth="12"
              strokeDasharray="24 16"
              strokeDashoffset={-frame * 5}
              strokeLinecap="round"
            />
            <line
              x1="370"
              y1="380"
              x2="780"
              y2="550"
              stroke="#fde047"
              strokeWidth="9"
              strokeDasharray="20 14"
              strokeDashoffset={-frame * 4}
              strokeLinecap="round"
            />
            <rect
              x="390"
              y="370"
              width="250"
              height="60"
              rx="16"
              fill="#fef08a"
              stroke="#ca8a04"
              strokeWidth="5"
            />
            <text
              x="515"
              y="414"
              fontSize="48"
              fontWeight="800"
              fill="#854d0e"
              textAnchor="middle"
            >
              ☀️ Sunlight
            </text>
          </g>
        )}

        {/* ================= ROOTS (Underground) ================= */}
        <g stroke="#d97706" strokeWidth="14" strokeLinecap="round" fill="none">
          <path d="M 880 720 Q 880 840 880 980" />
          <path d="M 880 760 Q 820 830 740 920" />
          <path d="M 880 810 Q 940 880 1020 960" />
          <path d="M 880 880 Q 830 940 780 1010" />
          <path d="M 740 920 Q 690 960 640 990" />
          <path d="M 1020 960 Q 1070 990 1120 1010" />
        </g>

        {/* ================= PLANT STEM ================= */}
        <path
          d="M 880 730 L 880 430"
          stroke="#16a34a"
          strokeWidth="36"
          strokeLinecap="round"
          fill="none"
        />

        {/* ================= LEFT LEAF (Main Factory) ================= */}
        <g transform="translate(870, 560)">
          {/* Glow filter during reaction */}
          {leafGlow > 0 && (
            <path
              d="M 0 0 C -120 -80, -320 -70, -360 40 C -300 130, -100 100, 0 10 Z"
              fill="#86efac"
              opacity={leafGlow * 0.8}
              filter="url(#glow)"
            />
          )}
          {/* Leaf Body */}
          <path
            d="M 0 0 C -120 -80, -320 -70, -360 40 C -300 130, -100 100, 0 10 Z"
            fill="#22c55e"
            stroke="#15803d"
            strokeWidth="8"
          />
          {/* Leaf Veins */}
          <path
            d="M 0 5 Q -180 0 -340 38"
            stroke="#16a34a"
            strokeWidth="7"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M -120 0 L -170 -35"
            stroke="#16a34a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M -180 5 L -230 42"
            stroke="#16a34a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M -240 14 L -290 -18"
            stroke="#16a34a"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <text
            x="-210"
            y="95"
            fontSize="44"
            fontWeight="800"
            fill="#052e16"
            textAnchor="middle"
          >
            Leaf (Chloroplasts)
          </text>
        </g>

        {/* ================= RIGHT LEAF ================= */}
        <g transform="translate(885, 500)">
          <path
            d="M 0 0 C 100 -70, 260 -50, 310 30 C 250 110, 80 80, 0 5 Z"
            fill="#16a34a"
            stroke="#15803d"
            strokeWidth="7"
          />
          <path
            d="M 0 5 Q 150 0 290 28"
            stroke="#15803d"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Flower at top */}
        <g transform="translate(880, 420)">
          <circle cx="-25" cy="-25" r="28" fill="#f43f5e" />
          <circle cx="25" cy="-25" r="28" fill="#f43f5e" />
          <circle cx="-25" cy="25" r="28" fill="#f43f5e" />
          <circle cx="25" cy="25" r="28" fill="#f43f5e" />
          <circle cx="0" cy="0" r="28" fill="#fbbf24" stroke="#d97706" strokeWidth="5" />
        </g>

        {/* ================= WATER (H2O) ANIMATION ================= */}
        {frame >= 120 && (
          <g>
            {/* Animated blue water arrows / droplets along root & stem */}
            {[0, 80, 160].map((offset, idx) => {
              const yPos = 980 - ((waterFlow + offset) % 400);
              return (
                <circle
                  key={idx}
                  cx="880"
                  cy={yPos}
                  r="14"
                  fill="#0284c7"
                  stroke="#e0f2fe"
                  strokeWidth="4"
                />
              );
            })}
            {/* Water label */}
            <g transform="translate(940, 820)">
              <rect
                x="0"
                y="-45"
                width="340"
                height="70"
                rx="18"
                fill="#0284c7"
                stroke="#0369a1"
                strokeWidth="5"
              />
              <text
                x="170"
                y="6"
                fontSize="50"
                fontWeight="900"
                fill="#ffffff"
                textAnchor="middle"
              >
                💧 Water (H₂O)
              </text>
            </g>
          </g>
        )}

        {/* ================= CARBON DIOXIDE (CO2) IN ================= */}
        {frame >= 280 && (
          <g
            transform={`translate(${interpolate(
              co2Progress,
              [0, 1],
              [140, 470]
            )}, 590)`}
            opacity={Math.min(1, (frame - 280) / 25)}
          >
            {/* Arrow */}
            <path
              d="M 120 0 L 190 0 M 170 -16 L 200 0 L 170 16"
              stroke="#7c3aed"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <rect
              x="-180"
              y="-46"
              width="310"
              height="80"
              rx="20"
              fill="#8b5cf6"
              stroke="#6d28d9"
              strokeWidth="6"
            />
            <text
              x="-25"
              y="12"
              fontSize="52"
              fontWeight="900"
              fill="#ffffff"
              textAnchor="middle"
            >
              💨 CO₂ (Air)
            </text>
          </g>
        )}

        {/* ================= PRODUCTS: O2 & GLUCOSE ================= */}
        {frame >= 440 && (
          <g
            transform={`scale(${Math.max(0, Math.min(1, productSpring))})`}
            style={{ transformOrigin: "900px 480px" }}
          >
            {/* Oxygen floating away */}
            <g transform={`translate(1220, ${420 - Math.sin(frame * 0.1) * 15})`}>
              <rect
                x="-40"
                y="-46"
                width="360"
                height="80"
                rx="20"
                fill="#059669"
                stroke="#047857"
                strokeWidth="6"
              />
              <text
                x="140"
                y="12"
                fontSize="50"
                fontWeight="900"
                fill="#ffffff"
                textAnchor="middle"
              >
                🌿 Oxygen (O₂)
              </text>
              {/* Upward arrow */}
              <path
                d="M 140 -60 L 140 -110 M 115 -85 L 140 -115 L 165 -85"
                stroke="#059669"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>

            {/* Glucose stored in plant */}
            <g transform="translate(1220, 560)">
              <rect
                x="-40"
                y="-46"
                width="420"
                height="80"
                rx="20"
                fill="#ea580c"
                stroke="#c2410c"
                strokeWidth="6"
              />
              <text
                x="170"
                y="12"
                fontSize="50"
                fontWeight="900"
                fill="#ffffff"
                textAnchor="middle"
              >
                🍬 Glucose (Food)
              </text>
              {/* Arrow pointing to plant */}
              <path
                d="M -55 -6 L -120 -6 M -95 -24 L -130 -6 L -95 12"
                stroke="#ea580c"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </g>
          </g>
        )}
      </svg>

      {/* ================= FINAL STEP: CHEMICAL EQUATION OVERLAY ================= */}
      {frame >= 590 && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 60,
            right: 60,
            height: 380,
            backgroundColor: "#ffffff",
            borderRadius: 32,
            border: "8px solid #0284c7",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "20px 40px",
            zIndex: 50,
            transform: `translateY(${(1 - Math.max(0, Math.min(1, equationEntrance))) * 450}px)`,
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: 0.5,
            }}
          >
            The Photosynthesis Chemical Equation
          </div>

          {/* Large Balanced Formula */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 24,
              backgroundColor: "#f8fafc",
              padding: "16px 36px",
              borderRadius: 24,
              border: "4px dashed #cbd5e1",
            }}
          >
            <span style={{ fontSize: 62, fontWeight: 900, color: "#7c3aed" }}>
              6CO₂
            </span>
            <span style={{ fontSize: 60, fontWeight: 800, color: "#64748b" }}>+</span>
            <span style={{ fontSize: 62, fontWeight: 900, color: "#0284c7" }}>
              6H₂O
            </span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                margin: "0 10px",
              }}
            >
              <span style={{ fontSize: 34, fontWeight: 800, color: "#d97706" }}>
                Light + Chlorophyll
              </span>
              <span style={{ fontSize: 64, fontWeight: 900, color: "#0f172a" }}>
                ──────▶
              </span>
            </div>
            <span style={{ fontSize: 62, fontWeight: 900, color: "#ea580c" }}>
              C₆H₁₂O₆
            </span>
            <span style={{ fontSize: 60, fontWeight: 800, color: "#64748b" }}>+</span>
            <span style={{ fontSize: 62, fontWeight: 900, color: "#059669" }}>
              6O₂
            </span>
          </div>

          {/* Subtitles / English translation for students */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "90%",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            <span style={{ color: "#7c3aed" }}>Carbon Dioxide</span>
            <span style={{ color: "#0284c7" }}>Water</span>
            <span style={{ color: "#ea580c" }}>Glucose (Energy)</span>
            <span style={{ color: "#059669" }}>Oxygen (We breathe!)</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};