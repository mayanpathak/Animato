import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from "remotion";

export const DURATION_SECONDS = 30;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase ranges (in frames @ 20fps, total = 600 frames = 30s)
  // Intro: 0-65 (3.25s)
  // Stage 1: Evaporation: 65-195 (6.5s)
  // Stage 2: Condensation: 195-325 (6.5s)
  // Stage 3: Precipitation: 325-455 (6.5s)
  // Stage 4: Collection: 455-545 (4.5s)
  // Summary/Review: 545-600 (2.75s)

  // Current stage detection
  let currentStageIndex = 0; // 0: intro, 1: evap, 2: condens, 3: precip, 4: collect, 5: summary
  if (frame >= 65 && frame < 195) currentStageIndex = 1;
  else if (frame >= 195 && frame < 325) currentStageIndex = 2;
  else if (frame >= 325 && frame < 455) currentStageIndex = 3;
  else if (frame >= 455 && frame < 545) currentStageIndex = 4;
  else if (frame >= 545) currentStageIndex = 5;

  // Active steps data
  const steps = [
    {
      title: "THE WATER CYCLE",
      desc: "How Earth constantly recycles water through air, land, and sea.",
      badge: "CLASS 6 SCIENCE",
    },
    {
      title: "1. EVAPORATION",
      desc: "The warm Sun heats water in the ocean, turning it into rising water vapour.",
      badge: "STEP 1 OF 4",
    },
    {
      title: "2. CONDENSATION",
      desc: "High up in cooler air, water vapour chills and gathers into fluffy clouds.",
      badge: "STEP 2 OF 4",
    },
    {
      title: "3. PRECIPITATION",
      desc: "Clouds grow heavy with water droplets, which fall back to Earth as rain.",
      badge: "STEP 3 OF 4",
    },
    {
      title: "4. COLLECTION",
      desc: "Rainwater flows down hills and rivers, gathering back into the vast ocean.",
      badge: "STEP 4 OF 4",
    },
    {
      title: "THE NEVER-ENDING CYCLE",
      desc: "Evaporation → Condensation → Precipitation → Collection (Repeats forever!)",
      badge: "SUMMARY",
    },
  ];

  const currentStep = steps[currentStageIndex];

  // Global scene fade in
  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Sun animations
  const sunPulse = 1 + 0.05 * Math.sin(frame * 0.1);
  const sunRayRotation = frame * 0.6;
  const sunHighlight = currentStageIndex === 1 ? 1.15 : 1.0;

  // Clouds animation
  const cloudScale = interpolate(
    frame,
    [0, 195, 230],
    [0.7, 0.7, 1.05],
    { extrapolateRight: "clamp" }
  );

  // Precipitation intensity
  const isRaining = frame >= 325;
  const rainOpacity = interpolate(
    frame,
    [325, 340, 545, 560],
    [0, 1, 1, 0.7],
    { extrapolateRight: "clamp" }
  );

  // Collection river glow
  const isCollecting = frame >= 455;
  const riverDashOffset = -frame * 3;

  // Evaporation particles active in step 1, step 4, and summary
  const isEvaporating = (frame >= 65 && frame < 195) || frame >= 545;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0369A1",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
        opacity: sceneOpacity,
      }}
    >
      {/* SKY BACKGROUND */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          background: "linear-gradient(180deg, #BAE6FD 0%, #E0F2FE 55%, #F0F9FF 100%)",
        }}
      />

      {/* SVG SCENERY: SUN, LAND, MOUNTAIN, OCEAN, RIVER */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          <linearGradient id="mountainGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id="mountainGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          <linearGradient id="snowCap" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="riverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* --- SUN SECTION (Top-Left) --- */}
        <g
          transform={`translate(320, 240) scale(${sunPulse * sunHighlight})`}
          style={{ transformOrigin: "0 0" }}
        >
          {/* Radiating sun rays */}
          <g transform={`rotate(${sunRayRotation})`}>
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="0"
                y1="0"
                x2={130 * Math.cos((deg * Math.PI) / 180)}
                y2={130 * Math.sin((deg * Math.PI) / 180)}
                stroke="#FDE047"
                strokeWidth="10"
                strokeLinecap="round"
                opacity="0.85"
              />
            ))}
          </g>
          {/* Sun Body */}
          <circle cx="0" cy="0" r="85" fill="#FBBF24" />
          <circle cx="0" cy="0" r="72" fill="#FDE047" />
          {/* Solar heat rays downward toward ocean when evaporating */}
          {isEvaporating && (
            <g opacity="0.45">
              <line x1="0" y1="90" x2="30" y2="380" stroke="#F59E0B" strokeWidth="8" strokeDasharray="16 12" />
              <line x1="-40" y1="85" x2="-80" y2="380" stroke="#F59E0B" strokeWidth="8" strokeDasharray="16 12" />
              <line x1="40" y1="85" x2="120" y2="380" stroke="#F59E0B" strokeWidth="8" strokeDasharray="16 12" />
            </g>
          )}
        </g>

        {/* --- MOUNTAINS (Right side) --- */}
        {/* Background Mountain */}
        <polygon points="1200,850 1480,380 1780,850" fill="url(#mountainGrad2)" />
        {/* Snow peak background */}
        <polygon points="1445,435 1480,380 1520,445 1490,435 1475,445" fill="url(#snowCap)" />

        {/* Foreground Mountain */}
        <polygon points="980,850 1280,430 1620,850" fill="url(#mountainGrad1)" />
        {/* Snow peak foreground */}
        <polygon points="1235,490 1280,430 1330,500 1300,490 1285,502 1260,490" fill="url(#snowCap)" />

        {/* Mountain ridge green land */}
        <path
          d="M 900 850 Q 1150 780 1400 830 T 1920 810 L 1920 1080 L 900 1080 Z"
          fill="#10B981"
        />

        {/* --- WINDING RIVER (From Mountain to Ocean) --- */}
        <path
          d="M 1270 570 Q 1200 680 1140 760 T 960 870 T 820 930"
          fill="none"
          stroke="url(#riverGrad)"
          strokeWidth={isCollecting ? "48" : "36"}
          strokeLinecap="round"
        />
        {/* River current animated dashes */}
        <path
          d="M 1270 570 Q 1200 680 1140 760 T 960 870 T 820 930"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="10"
          strokeDasharray="24 24"
          strokeDashoffset={riverDashOffset}
          opacity="0.8"
        />

        {/* --- OCEAN (Left and Bottom) --- */}
        <path
          d="M 0 740 Q 240 710 480 740 T 960 760 L 960 1080 L 0 1080 Z"
          fill="url(#oceanGrad)"
        />

        {/* Ocean Waves (Animated) */}
        {[-30, 20, 80].map((yOffset, idx) => {
          const waveShift = Math.sin((frame + idx * 25) * 0.1) * 30;
          return (
            <path
              key={idx}
              d={`M ${-40 + waveShift} ${780 + yOffset} Q 180 ${760 + yOffset} 400 ${780 + yOffset} T 880 ${790 + yOffset}`}
              fill="none"
              stroke="#E0F2FE"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.6"
            />
          );
        })}

        {/* --- STAGE 1: EVAPORATION PARTICLES (Rising Vapour) --- */}
        {isEvaporating && (
          <g>
            {[180, 280, 380, 480, 580].map((x, i) => {
              const speed = 4;
              const yCycle = (frame * speed + i * 45) % 240;
              const yPos = 700 - yCycle;
              const opacityVal = interpolate(yCycle, [0, 50, 180, 240], [0, 0.9, 0.9, 0]);
              const waveX = x + Math.sin((frame + i * 15) * 0.15) * 16;
              return (
                <g key={i} opacity={opacityVal}>
                  {/* Wavy steam path */}
                  <path
                    d={`M ${waveX} ${yPos} Q ${waveX - 18} ${yPos - 25} ${waveX} ${yPos - 50} T ${waveX} ${yPos - 100}`}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <circle cx={waveX} cy={yPos - 108} r="6" fill="#38BDF8" />
                </g>
              );
            })}
          </g>
        )}

        {/* --- STAGE 2: CONDENSATION CLOUDS (Top-Right / Mountain) --- */}
        <g
          transform={`translate(1380, 280) scale(${cloudScale})`}
          style={{ transformOrigin: "0 0" }}
        >
          {/* Shadow cloud */}
          <ellipse cx="-40" cy="40" rx="140" ry="75" fill="#94A3B8" opacity="0.3" />
          <ellipse cx="60" cy="45" rx="120" ry="65" fill="#94A3B8" opacity="0.3" />

          {/* Main puffy cloud body */}
          <ellipse cx="-70" cy="15" rx="120" ry="70" fill={isRaining ? "#E2E8F0" : "#FFFFFF"} />
          <ellipse cx="60" cy="20" rx="110" ry="65" fill={isRaining ? "#CBD5E1" : "#FFFFFF"} />
          <circle cx="0" cy="-35" r="95" fill={isRaining ? "#E2E8F0" : "#FFFFFF"} />
          <circle cx="-95" cy="-10" r="75" fill={isRaining ? "#CBD5E1" : "#FFFFFF"} />
          <circle cx="95" cy="-5" r="75" fill={isRaining ? "#CBD5E1" : "#FFFFFF"} />

          {/* Smaller fluffy neighbor cloud */}
          <g transform="translate(-280, 40) scale(0.7)">
            <ellipse cx="0" cy="0" rx="90" ry="50" fill={isRaining ? "#E2E8F0" : "#FFFFFF"} />
            <circle cx="-35" cy="-25" r="55" fill={isRaining ? "#CBD5E1" : "#FFFFFF"} />
            <circle cx="35" cy="-20" r="50" fill={isRaining ? "#FFFFFF" : "#FFFFFF"} />
          </g>
        </g>

        {/* --- STAGE 3: PRECIPITATION (Rain drops falling) --- */}
        {isRaining && (
          <g opacity={rainOpacity}>
            {[
              1120, 1160, 1210, 1260, 1310, 1360, 1420, 1470, 1530, 1580,
              1140, 1190, 1240, 1290, 1340, 1390, 1450, 1500, 1560,
            ].map((rx, idx) => {
              const fallSpeed = 16;
              const yProg = ((frame - 325) * fallSpeed + idx * 37) % 360;
              const startY = 380;
              const dropY = startY + yProg;
              return (
                <line
                  key={idx}
                  x1={rx}
                  y1={dropY}
                  x2={rx - 12}
                  y2={dropY + 28}
                  stroke="#0284C7"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity={dropY > 730 ? 0 : 0.85}
                />
              );
            })}
          </g>
        )}

        {/* --- SUMMARY / ON-SCREEN DIAGRAM BADGES (Appears during summary) --- */}
        {currentStageIndex === 5 && (
          <g opacity={interpolate(frame, [545, 560], [0, 1], { extrapolateRight: "clamp" })}>
            {/* Curved cycle arrow */}
            <path
              d="M 450 480 C 450 160, 1200 120, 1350 200"
              fill="none"
              stroke="#0369A1"
              strokeWidth="6"
              strokeDasharray="16 12"
            />
            <path
              d="M 1380 540 C 1380 720, 1050 820, 850 860"
              fill="none"
              stroke="#0369A1"
              strokeWidth="6"
              strokeDasharray="16 12"
            />
          </g>
        )}
      </svg>

      {/* --- IN-PLACE CALLOUT LABELS ON THE LANDSCAPE --- */}
      {/* 1. Evaporation Callout */}
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 610,
          backgroundColor: currentStageIndex === 1 ? "#0284C7" : "rgba(255,255,255,0.9)",
          color: currentStageIndex === 1 ? "#FFFFFF" : "#0369A1",
          padding: "10px 24px",
          borderRadius: 40,
          fontSize: 32,
          fontWeight: 800,
          border: "4px solid #0284C7",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          transform: currentStageIndex === 1 ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.2s ease",
        }}
      >
        1. EVAPORATION
      </div>

      {/* 2. Condensation Callout */}
      <div
        style={{
          position: "absolute",
          left: 1420,
          top: 170,
          backgroundColor: currentStageIndex === 2 ? "#0284C7" : "rgba(255,255,255,0.9)",
          color: currentStageIndex === 2 ? "#FFFFFF" : "#0369A1",
          padding: "10px 24px",
          borderRadius: 40,
          fontSize: 32,
          fontWeight: 800,
          border: "4px solid #0284C7",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          transform: currentStageIndex === 2 ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.2s ease",
        }}
      >
        2. CONDENSATION
      </div>

      {/* 3. Precipitation Callout */}
      <div
        style={{
          position: "absolute",
          left: 1530,
          top: 520,
          backgroundColor: currentStageIndex === 3 ? "#0284C7" : "rgba(255,255,255,0.9)",
          color: currentStageIndex === 3 ? "#FFFFFF" : "#0369A1",
          padding: "10px 24px",
          borderRadius: 40,
          fontSize: 32,
          fontWeight: 800,
          border: "4px solid #0284C7",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          transform: currentStageIndex === 3 ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.2s ease",
        }}
      >
        3. PRECIPITATION
      </div>

      {/* 4. Collection Callout */}
      <div
        style={{
          position: "absolute",
          left: 770,
          top: 980,
          backgroundColor: currentStageIndex === 4 ? "#0284C7" : "rgba(255,255,255,0.9)",
          color: currentStageIndex === 4 ? "#FFFFFF" : "#0369A1",
          padding: "10px 24px",
          borderRadius: 40,
          fontSize: 32,
          fontWeight: 800,
          border: "4px solid #0284C7",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          transform: currentStageIndex === 4 ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.2s ease",
        }}
      >
        4. COLLECTION
      </div>

      {/* --- TOP CLASSROOM LESSON BANNER (Large, legible projection display) --- */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 210,
          width: 1500,
          backgroundColor: "#FFFFFF",
          borderRadius: 28,
          padding: "24px 44px",
          boxShadow: "0 20px 40px rgba(3, 105, 161, 0.2)",
          border: "5px solid #38BDF8",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Stage Badge */}
        <div
          style={{
            backgroundColor: "#E0F2FE",
            color: "#0369A1",
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: 3,
            padding: "6px 20px",
            borderRadius: 20,
            marginBottom: 8,
          }}
        >
          {currentStep.badge}
        </div>

        {/* Main Title (>= 80px per requirements) */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: "#0F172A",
            lineHeight: 1.1,
            letterSpacing: -1,
            margin: "0 0 10px 0",
          }}
        >
          {currentStep.title}
        </div>

        {/* Explanation text (>= 44px per requirements) */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: "#334155",
            lineHeight: 1.25,
            maxWidth: 1350,
          }}
        >
          {currentStep.desc}
        </div>
      </div>
    </AbsoluteFill>
  );
};