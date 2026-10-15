import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from "remotion";

export const DURATION_SECONDS = 30;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Active stage determination based on 900 frames total
  // 0 - 90: Intro
  // 90 - 280: Stage 1 - Evaporation
  // 280 - 470: Stage 2 - Condensation
  // 470 - 660: Stage 3 - Precipitation
  // 660 - 810: Stage 4 - Collection
  // 810 - 900: Recap / Endless Cycle

  // Sun pulsation & rays
  const sunPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.95, 1.05]);
  const sunRayRotate = (frame * 0.4) % 360;

  // Evaporation particles animation (Stage 1: 90 - 300, visible slightly throughout)
  const evapOpacity = interpolate(frame, [90, 120, 270, 310], [0, 1, 1, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cloud density/growth (Stage 2: 280 - 480)
  const cloudScale = interpolate(frame, [0, 280, 350], [0.8, 0.8, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cloudColor = interpolate(frame, [450, 520], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rain falling animation (Stage 3: 470 - 680)
  const rainOpacity = interpolate(frame, [470, 500, 650, 680], [0, 1, 1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // River flow dash offset (Stage 4: 660 - 810)
  const riverFlow = (frame * 8) % 60;
  const riverHighlight = interpolate(frame, [660, 690, 800, 830], [0.3, 1, 1, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stage banner info
  const stageBanner = useMemo(() => {
    if (frame < 90) {
      return {
        step: "SCIENCE CLASS 6",
        title: "The Water Cycle",
        desc: "How water continuously moves through Earth and sky",
        activeStage: 0,
      };
    } else if (frame < 280) {
      return {
        step: "STAGE 1",
        title: "Evaporation",
        desc: "The Sun heats the ocean, turning liquid water into rising vapor",
        activeStage: 1,
      };
    } else if (frame < 470) {
      return {
        step: "STAGE 2",
        title: "Condensation",
        desc: "Cool air turns rising water vapor into tiny droplets, forming clouds",
        activeStage: 2,
      };
    } else if (frame < 660) {
      return {
        step: "STAGE 3",
        title: "Precipitation",
        desc: "Heavy droplets fall back to Earth as rain, snow, or hail",
        activeStage: 3,
      };
    } else if (frame < 810) {
      return {
        step: "STAGE 4",
        title: "Collection",
        desc: "Rainwater gathers into streams, rivers, and flows back to the ocean",
        activeStage: 4,
      };
    } else {
      return {
        step: "COMPLETE CYCLE",
        title: "The Endless Cycle",
        desc: "Evaporation -> Condensation -> Precipitation -> Collection",
        activeStage: 5,
      };
    }
  }, [frame]);

  const bannerSpring = spring({
    frame: frame % 190,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Procedural vapor particles
  const vaporPuffs = useMemo(() => {
    return Array.from({ length: 9 }).map((_, i) => ({
      x: 1300 + (i % 3) * 110 + ((i * 37) % 50),
      speed: 1.8 + (i % 3) * 0.6,
      delay: i * 14,
      size: 14 + (i % 4) * 6,
    }));
  }, []);

  // Procedural rain drops
  const rainDrops = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      x: 420 + (i * 38) + ((i * 19) % 25),
      startY: 420 + ((i * 23) % 40),
      speed: 12 + (i % 5) * 3,
      length: 22 + (i % 3) * 8,
      delay: (i * 7) % 30,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#e0f2fe",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: "hidden",
      }}
    >
      {/* SKY BACKGROUND GRADIENT */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #bae6fd 0%, #e0f2fe 55%, #f8fafc 100%)",
        }}
      />

      {/* SUN (Top Right) */}
      <div
        style={{
          position: "absolute",
          right: 140,
          top: 90,
          width: 220,
          height: 220,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${sunPulse})`,
        }}
      >
        {/* Sun rays SVG */}
        <svg
          width="260"
          height="260"
          viewBox="0 0 260 260"
          style={{
            position: "absolute",
            transform: `rotate(${sunRayRotate}deg)`,
          }}
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <line
              key={idx}
              x1="130"
              y1="20"
              x2="130"
              y2="45"
              stroke="#fbbf24"
              strokeWidth="8"
              strokeLinecap="round"
              transform={`rotate(${idx * 30} 130 130)`}
            />
          ))}
        </svg>

        {/* Sun Core */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            backgroundColor: "#f59e0b",
            boxShadow: "0 0 50px #fbbf24, inset -10px -10px 20px #d97706",
          }}
        />
      </div>

      {/* LANDSCAPE SVG: Mountains, Hills, River, and Ocean */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {/* Distant Mountains */}
        <polygon points="120,780 400,420 680,780" fill="#93c5fd" opacity="0.65" />
        <polygon points="400,420 480,530 400,510 320,530" fill="#ffffff" opacity="0.9" />

        <polygon points="380,780 620,490 880,780" fill="#60a5fa" opacity="0.5" />
        <polygon points="620,490 670,560 620,550 570,560" fill="#ffffff" opacity="0.9" />

        {/* Rolling Green/Teal Hills */}
        <path
          d="M -50 820 Q 250 680 580 820 T 1150 820 L 1150 1080 L -50 1080 Z"
          fill="#38bdf8"
          opacity="0.3"
        />
        <path
          d="M -50 880 Q 200 780 500 860 Q 800 940 1050 880 L 1050 1080 L -50 1080 Z"
          fill="#0284c7"
          opacity="0.35"
        />

        {/* Ocean Basin (Right side) */}
        <path
          d="M 980 840 Q 1150 830 1350 845 T 1940 840 L 1940 1080 L 980 1080 Z"
          fill="#0284c7"
        />
        <path
          d="M 1020 880 C 1250 860, 1500 890, 1940 870 L 1940 1080 L 1020 1080 Z"
          fill="#0369a1"
        />

        {/* Animated Ocean Waves */}
        <path
          d={`M 1000 ${855 + Math.sin(frame * 0.1) * 4} Q 1200 ${850 - Math.sin(frame * 0.1) * 4} 1450 ${855 + Math.sin(frame * 0.1) * 4} T 1920 ${855 - Math.sin(frame * 0.1) * 4}`}
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* River from Mountain to Ocean */}
        <path
          d="M 440 680 Q 520 760 650 820 Q 800 880 1060 880"
          fill="none"
          stroke={riverHighlight > 0.6 ? "#7dd3fc" : "#38bdf8"}
          strokeWidth="28"
          strokeLinecap="round"
          strokeDasharray="24 16"
          strokeDashoffset={-riverFlow}
          opacity={riverHighlight}
        />
      </svg>

      {/* STAGE 1: VAPOR PARTICLES (Rising to Clouds) */}
      <div style={{ position: "absolute", width: "100%", height: "100%", opacity: evapOpacity }}>
        {vaporPuffs.map((puff, i) => {
          const progress = ((frame * puff.speed + puff.delay * 8) % 180) / 180;
          const y = interpolate(progress, [0, 1], [820, 420]);
          const currentX = puff.x + Math.sin(progress * Math.PI * 4 + i) * 22;
          const puffOpacity = interpolate(progress, [0, 0.2, 0.8, 1], [0, 0.8, 0.8, 0]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: currentX,
                top: y,
                width: puff.size,
                height: puff.size * 1.5,
                borderRadius: "50%",
                background: "linear-gradient(180deg, #ffffff 0%, #38bdf8 100%)",
                opacity: puffOpacity,
                filter: "blur(2px)",
              }}
            />
          );
        })}

        {/* Evaporation Directional Curved Arrows */}
        <svg width="1920" height="1080" style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d="M 1450 780 Q 1480 620 1350 490"
            fill="none"
            stroke="#0284c7"
            strokeWidth="5"
            strokeDasharray="10 8"
            opacity="0.7"
          />
          <polygon points="1350,480 1340,500 1365,495" fill="#0284c7" />

          <path
            d="M 1600 770 Q 1660 600 1480 460"
            fill="none"
            stroke="#0284c7"
            strokeWidth="5"
            strokeDasharray="10 8"
            opacity="0.7"
          />
          <polygon points="1480,450 1475,472 1498,464" fill="#0284c7" />
        </svg>
      </div>

      {/* STAGE 2: CLOUDS (Condensation) */}
      <div
        style={{
          position: "absolute",
          left: 420,
          top: 250,
          transform: `scale(${cloudScale})`,
          transition: "transform 0.3s ease-out",
        }}
      >
        <svg width="600" height="300" viewBox="0 0 600 300">
          {/* Back darker cloud */}
          <path
            d="M 120 180 Q 140 100 240 110 Q 320 60 410 120 Q 490 120 500 190 Q 510 250 430 250 L 140 250 Q 80 230 120 180 Z"
            fill={cloudColor > 0.5 ? "#94a3b8" : "#cbd5e1"}
            opacity="0.85"
            transform="translate(40, -20) scale(0.95)"
          />
          {/* Main front cloud */}
          <path
            d="M 100 190 Q 120 110 210 120 Q 280 70 370 120 Q 450 110 470 180 Q 490 240 400 250 L 120 250 Q 60 230 100 190 Z"
            fill={cloudColor > 0.5 ? "#cbd5e1" : "#ffffff"}
            style={{
              filter: "drop-shadow(0 15px 25px rgba(2, 132, 199, 0.2))",
            }}
          />
        </svg>
      </div>

      {/* STAGE 3: PRECIPITATION (Rain drops falling over mountains) */}
      <div style={{ position: "absolute", width: "100%", height: "100%", opacity: rainOpacity }}>
        {rainDrops.map((drop, idx) => {
          const dropProgress = ((frame * drop.speed + drop.delay * 12) % 300) / 300;
          const currentY = drop.startY + dropProgress * 360;
          const currentX = drop.x - dropProgress * 60; // slanted falling

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: currentX,
                top: currentY,
                width: 4,
                height: drop.length,
                backgroundColor: "#0284c7",
                borderRadius: 4,
                transform: "rotate(15deg)",
                opacity: 0.8,
              }}
            />
          );
        })}
      </div>

      {/* DIAGRAM FLOW ARROW (CYCLE RECAP OVERVIEW) */}
      {stageBanner.activeStage === 5 && (
        <svg
          width="1920"
          height="1080"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            pointerEvents: "none",
          }}
        >
          {/* Circular guiding arrows */}
          <path
            d="M 1420 440 C 1320 260, 850 220, 680 320"
            fill="none"
            stroke="#0369a1"
            strokeWidth="6"
            strokeDasharray="14 10"
          />
          <path
            d="M 520 480 C 440 620, 480 760, 680 830"
            fill="none"
            stroke="#0369a1"
            strokeWidth="6"
            strokeDasharray="14 10"
          />
          <path
            d="M 760 860 C 920 900, 1280 890, 1420 810"
            fill="none"
            stroke="#0369a1"
            strokeWidth="6"
            strokeDasharray="14 10"
          />
          <path
            d="M 1520 780 C 1620 680, 1600 520, 1450 430"
            fill="none"
            stroke="#0369a1"
            strokeWidth="6"
            strokeDasharray="14 10"
          />
        </svg>
      )}

      {/* PERMANENT LOCATION LABELS */}
      <div
        style={{
          position: "absolute",
          right: 280,
          bottom: 110,
          color: "#ffffff",
          fontSize: 46,
          fontWeight: 800,
          textShadow: "0 2px 8px rgba(0,0,0,0.4)",
          letterSpacing: 1,
        }}
      >
        OCEAN
      </div>

      <div
        style={{
          position: "absolute",
          left: 210,
          top: 610,
          color: "#0369a1",
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        LAND / MOUNTAINS
      </div>

      <div
        style={{
          position: "absolute",
          left: 720,
          top: 890,
          color: "#0284c7",
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        RIVER
      </div>

      {/* TOP HEADER & STAGE CARD (Educational Display) */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        {/* Main Stage Text Card */}
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.94)",
            padding: "24px 44px",
            borderRadius: 24,
            boxShadow: "0 20px 40px rgba(3, 105, 161, 0.15)",
            border: "3px solid #bae6fd",
            maxWidth: 1040,
            transform: `scale(${bannerSpring})`,
            transformOrigin: "top left",
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: "#0284c7",
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 800,
              padding: "6px 18px",
              borderRadius: 30,
              marginBottom: 10,
              letterSpacing: 1.5,
            }}
          >
            {stageBanner.step}
          </div>
          <div
            style={{
              fontSize: 82,
              fontWeight: 900,
              color: "#0369a1",
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            {stageBanner.title}
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              color: "#334155",
              lineHeight: 1.25,
            }}
          >
            {stageBanner.desc}
          </div>
        </div>

        {/* 4-Step Visual Progress Indicator */}
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.94)",
            padding: "20px 28px",
            borderRadius: 20,
            border: "2px solid #bae6fd",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            boxShadow: "0 10px 25px rgba(3, 105, 161, 0.1)",
          }}
        >
          {[
            { num: "1", name: "Evaporation" },
            { num: "2", name: "Condensation" },
            { num: "3", name: "Precipitation" },
            { num: "4", name: "Collection" },
          ].map((item, idx) => {
            const isCurrent = stageBanner.activeStage === idx + 1;
            const isDone = stageBanner.activeStage > idx + 1 || stageBanner.activeStage === 5;

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  opacity: isCurrent || isDone ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    backgroundColor: isCurrent ? "#0284c7" : isDone ? "#38bdf8" : "#e2e8f0",
                    color: isCurrent || isDone ? "#ffffff" : "#64748b",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 24,
                    fontWeight: 800,
                  }}
                >
                  {item.num}
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? "#0369a1" : "#475569",
                  }}
                >
                  {item.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};