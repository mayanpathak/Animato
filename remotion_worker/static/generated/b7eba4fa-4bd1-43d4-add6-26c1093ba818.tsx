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

  // -------------------------------------------------------------
  // TIMINGS (600 frames total at 20 fps)
  // Stage 0: Intro (0 - 80)
  // Stage 1: Evaporation (80 - 210)
  // Stage 2: Condensation (210 - 340)
  // Stage 3: Precipitation (340 - 470)
  // Stage 4: Collection (470 - 580)
  // Wrap-up: Full cycle recap (580 - 600)
  // -------------------------------------------------------------

  // Sun pulsing & rays rotation
  const sunPulse = 1 + Math.sin(frame * 0.08) * 0.04;
  const sunRotation = (frame * 0.4) % 360;

  // Ocean wave shimmer
  const waveOffset1 = Math.sin(frame * 0.08) * 12;
  const waveOffset2 = Math.cos(frame * 0.06) * 15;

  // Clouds motion & scale
  const cloud1X = interpolate(frame, [0, 600], [920, 780], {
    extrapolateRight: "clamp",
  });
  const cloudScaleIntro = spring({
    frame: frame - 180,
    fps,
    config: { damping: 14, stiffness: 60 },
  });
  const cloudScale = interpolate(cloudScaleIntro, [0, 1], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cloudDarkness = interpolate(frame, [330, 390], [0, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Stage 1: Evaporation animations (80 - 210)
  const evapProgress = interpolate(frame, [80, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const evapFadeOut = interpolate(frame, [205, 220], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const evapOpacity = evapProgress * evapFadeOut;

  // Stage 2: Condensation card & highlights (210 - 340)
  const condProgress = interpolate(frame, [210, 240], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const condFadeOut = interpolate(frame, [335, 350], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const condOpacity = condProgress * condFadeOut;

  // Stage 3: Precipitation animations (340 - 470)
  const precipProgress = interpolate(frame, [340, 370], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const precipFadeOut = interpolate(frame, [465, 480], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const precipOpacity = precipProgress * precipFadeOut;

  // Stage 4: Collection flow animations (470 - 580)
  const collectProgress = interpolate(frame, [470, 500], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const collectFadeOut = interpolate(frame, [575, 595], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const collectOpacity = collectProgress * collectFadeOut;

  // Title Intro Banner (0 - 80)
  const titleOpacity = interpolate(frame, [0, 20, 65, 80], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });

  // Final Summary Badge (580 - 600)
  const summaryOpacity = interpolate(frame, [580, 595], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Deterministic Rain drops positions
  const rainDrops = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      x: 380 + (i % 8) * 45 + ((i * 19) % 30),
      speed: 16 + ((i * 7) % 10),
      initialY: (i * 37) % 250,
      length: 22 + (i % 3) * 10,
    }));
  }, []);

  // Deterministic Vapor particles positions
  const vaporParticles = useMemo(() => {
    return Array.from({ length: 18 }).map((_, i) => ({
      baseX: 1220 + (i % 6) * 75 + ((i * 13) % 40),
      speed: 2.2 + (i % 4) * 0.6,
      offset: i * 45,
      size: 16 + (i % 3) * 8,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d1b2a",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* ---------------- SKY BACKGROUND ---------------- */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#08203e" />
            <stop offset="45%" stopColor="#1e3c72" />
            <stop offset="100%" stopColor="#41729f" />
          </linearGradient>

          <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#195190" />
            <stop offset="60%" stopColor="#0f3460" />
            <stop offset="100%" stopColor="#081c33" />
          </linearGradient>

          <linearGradient id="mountainGrad" x1="0%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#3a506b" />
            <stop offset="100%" stopColor="#1c2541" />
          </linearGradient>

          <linearGradient id="snowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d0e1fd" />
          </linearGradient>

          <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* Sky Fill */}
        <rect width="1920" height="1080" fill="url(#skyGrad)" />

        {/* ---------------- SUN ---------------- */}
        <g transform="translate(1560, 220)">
          {/* Sun Corona / Glow */}
          <circle
            r="120"
            fill="#ffffff"
            opacity="0.12"
            transform={`scale(${sunPulse * 1.25})`}
          />
          <circle
            r="90"
            fill="#ffffff"
            opacity="0.2"
            transform={`scale(${sunPulse * 1.1})`}
          />

          {/* Rotating Sun Rays */}
          <g transform={`rotate(${sunRotation})`}>
            {Array.from({ length: 12 }).map((_, idx) => (
              <line
                key={idx}
                x1="0"
                y1="82"
                x2="0"
                y2="108"
                stroke="#ffffff"
                strokeWidth="7"
                strokeLinecap="round"
                transform={`rotate(${idx * 30})`}
                opacity="0.8"
              />
            ))}
          </g>

          {/* Sun Core */}
          <circle r="72" fill="#ffffff" />
          <circle r="68" fill="#e0f2fe" opacity="0.4" />
        </g>

        {/* Heat Waves from Sun toward Ocean (Evaporation Step Cue) */}
        {evapOpacity > 0.05 && (
          <g opacity={evapOpacity * 0.75}>
            <path
              d="M 1520 330 Q 1480 430 1510 520 T 1470 680"
              fill="none"
              stroke="#ffffff"
              strokeWidth="5"
              strokeDasharray="14 12"
              strokeDashoffset={-frame * 3}
            />
            <path
              d="M 1580 340 Q 1550 440 1590 540 T 1560 690"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="5"
              strokeDasharray="14 12"
              strokeDashoffset={-frame * 3.5}
            />
          </g>
        )}

        {/* ---------------- MOUNTAINS (LEFT) ---------------- */}
        {/* Distant Mountain Peak */}
        <polygon
          points="80,750 340,360 620,750"
          fill="#24344d"
        />
        {/* Main Mountain Peak */}
        <polygon
          points="-80,820 480,260 920,820"
          fill="url(#mountainGrad)"
        />
        {/* Mountain Snowcap */}
        <polygon
          points="480,260 410,360 445,390 480,365 520,400 550,360"
          fill="url(#snowGrad)"
        />

        {/* ---------------- RIVER (COLLECTION) ---------------- */}
        {/* Riverbed baseline */}
        <path
          d="M 480 420 Q 560 550 510 670 T 680 820 T 960 850"
          fill="none"
          stroke="#1e293b"
          strokeWidth="60"
          strokeLinecap="round"
        />
        {/* River Active Water */}
        <path
          d="M 480 420 Q 560 550 510 670 T 680 820 T 960 850"
          fill="none"
          stroke="url(#riverGrad)"
          strokeWidth="42"
          strokeLinecap="round"
        />
        {/* Flowing animated stream pulses */}
        <path
          d="M 480 420 Q 560 550 510 670 T 680 820 T 960 850"
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeDasharray="30 45"
          strokeDashoffset={-frame * 8}
          opacity="0.8"
        />

        {/* ---------------- OCEAN (RIGHT) ---------------- */}
        {/* Back Ocean Layer */}
        <path
          d={`M 820 830 Q 1120 ${805 + waveOffset1} 1420 825 T 1920 ${815 - waveOffset2} L 1920 1080 L 820 1080 Z`}
          fill="#133e6f"
        />
        {/* Front Deep Ocean */}
        <path
          d={`M 760 850 Q 1100 ${865 - waveOffset2} 1400 840 T 1920 ${855 + waveOffset1} L 1920 1080 L 760 1080 Z`}
          fill="url(#oceanGrad)"
        />
        {/* Ocean Surface Foam Highlights */}
        <path
          d={`M 780 854 Q 1080 ${868 - waveOffset2} 1420 844 T 1920 ${860 + waveOffset1}`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          opacity="0.75"
        />

        {/* ---------------- RAIN DROPS (PRECIPITATION) ---------------- */}
        {frame >= 335 && frame <= 480 && (
          <g opacity={precipOpacity}>
            {rainDrops.map((drop, idx) => {
              const currentY =
                420 + ((drop.initialY + frame * drop.speed) % 360);
              return (
                <line
                  key={idx}
                  x1={drop.x}
                  y1={currentY}
                  x2={drop.x - 4}
                  y2={currentY + drop.length}
                  stroke="#93c5fd"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              );
            })}
          </g>
        )}

        {/* ---------------- CLOUDS (CONDENSATION & PRECIPITATION) ---------------- */}
        <g
          transform={`translate(${cloud1X}, 280) scale(${Math.max(
            0.01,
            cloudScale
          )})`}
        >
          {/* Cloud Base & Puffs */}
          <g
            style={{
              filter: `brightness(${1 - cloudDarkness})`,
              transition: "filter 0.3s ease",
            }}
          >
            {/* Outer Cloud Glow */}
            <ellipse cx="0" cy="0" rx="210" ry="85" fill="#bae6fd" opacity="0.25" />

            {/* Cloud Shape Bubbles */}
            <circle cx="-130" cy="15" r="75" fill="#f0f9ff" />
            <circle cx="-60" cy="-45" r="95" fill="#ffffff" />
            <circle cx="50" cy="-35" r="85" fill="#ffffff" />
            <circle cx="135" cy="20" r="70" fill="#e0f2fe" />
            <ellipse cx="0" cy="35" rx="175" ry="60" fill="#f8fafc" />
            {/* Cloud Bottom Shading */}
            <ellipse cx="5" cy="55" rx="145" ry="32" fill="#cbd5e1" opacity="0.45" />
          </g>
        </g>
      </svg>

      {/* ---------------- EVAPORATION PARTICLES (HTML overlays for clean rising motion) ---------------- */}
      {evapOpacity > 0.05 &&
        vaporParticles.map((vp, idx) => {
          const particleY =
            840 - (((frame * vp.speed * 8 + vp.offset) % 480));
          const particleWobble = Math.sin((frame + vp.offset) * 0.12) * 18;
          const individualOpacity = interpolate(
            particleY,
            [840, 750, 480, 380],
            [0, evapOpacity, evapOpacity, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={idx}
              style={{
                position: "absolute",
                left: vp.baseX + particleWobble,
                top: particleY,
                width: vp.size,
                height: vp.size * 1.5,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, #ffffff 10%, #93c5fd 60%, transparent 90%)",
                opacity: individualOpacity,
                pointerEvents: "none",
              }}
            />
          );
        })}

      {/* Evaporation Arrow Path Indicator */}
      {evapOpacity > 0.1 && (
        <div
          style={{
            position: "absolute",
            left: 1380,
            top: 500,
            opacity: evapOpacity,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 54,
              color: "#ffffff",
              fontWeight: 800,
              textShadow: "0 4px 12px rgba(0,0,0,0.6)",
              transform: `translateY(${-Math.sin(frame * 0.2) * 10}px)`,
            }}
          >
            ▲
          </div>
        </div>
      )}

      {/* ---------------- TITLE CARD (INTRO: 0 - 80 frames) ---------------- */}
      {titleOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 0,
            width: 1920,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: titleOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(13, 27, 42, 0.88)",
              border: "6px solid #38bdf8",
              borderRadius: 36,
              padding: "24px 70px",
              textAlign: "center",
              boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: 96,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              The Water Cycle
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 600,
                color: "#7dd3fc",
                marginTop: 10,
              }}
            >
              Earth's Endless Journey of Water
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STAGE 1: EVAPORATION CARD ---------------- */}
      {evapOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: 80,
            maxWidth: 820,
            backgroundColor: "rgba(15, 34, 64, 0.94)",
            border: "5px solid #38bdf8",
            borderRadius: 28,
            padding: "30px 44px",
            opacity: evapOpacity,
            boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: "#38bdf8",
              letterSpacing: 1,
            }}
          >
            1. Evaporation
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#ffffff",
              marginTop: 14,
              lineHeight: 1.3,
            }}
          >
            The Sun heats the ocean, turning liquid water into warm invisible vapor that rises up.
          </div>
        </div>
      )}

      {/* ---------------- STAGE 2: CONDENSATION CARD ---------------- */}
      {condOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: 80,
            maxWidth: 820,
            backgroundColor: "rgba(15, 34, 64, 0.94)",
            border: "5px solid #93c5fd",
            borderRadius: 28,
            padding: "30px 44px",
            opacity: condOpacity,
            boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: "#93c5fd",
              letterSpacing: 1,
            }}
          >
            2. Condensation
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#ffffff",
              marginTop: 14,
              lineHeight: 1.3,
            }}
          >
            High in the sky, water vapor cools down and turns back into tiny water drops that form clouds!
          </div>
        </div>
      )}

      {/* ---------------- STAGE 3: PRECIPITATION CARD ---------------- */}
      {precipOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: 80,
            maxWidth: 840,
            backgroundColor: "rgba(15, 34, 64, 0.94)",
            border: "5px solid #60a5fa",
            borderRadius: 28,
            padding: "30px 44px",
            opacity: precipOpacity,
            boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: "#60a5fa",
              letterSpacing: 1,
            }}
          >
            3. Precipitation
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#ffffff",
              marginTop: 14,
              lineHeight: 1.3,
            }}
          >
            When cloud droplets become too heavy to float, gravity pulls them down as rain or snow!
          </div>
        </div>
      )}

      {/* ---------------- STAGE 4: COLLECTION CARD ---------------- */}
      {collectOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            top: 65,
            left: 80,
            maxWidth: 860,
            backgroundColor: "rgba(15, 34, 64, 0.94)",
            border: "5px solid #38bdf8",
            borderRadius: 28,
            padding: "30px 44px",
            opacity: collectOpacity,
            boxShadow: "0 18px 45px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 90,
              fontWeight: 900,
              color: "#38bdf8",
              letterSpacing: 1,
            }}
          >
            4. Collection
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#ffffff",
              marginTop: 14,
              lineHeight: 1.3,
            }}
          >
            Rainwater collects in rivers, streams, and oceans — ready to be heated all over again!
          </div>
        </div>
      )}

      {/* ---------------- FINAL SUMMARY / COMPLETE CYCLE ---------------- */}
      {summaryOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 0,
            width: 1920,
            display: "flex",
            justifyContent: "center",
            opacity: summaryOpacity,
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(13, 27, 42, 0.95)",
              border: "6px solid #60a5fa",
              borderRadius: 30,
              padding: "20px 50px",
              display: "flex",
              alignItems: "center",
              gap: 28,
              boxShadow: "0 14px 40px rgba(0,0,0,0.7)",
            }}
          >
            <span style={{ fontSize: 52, fontWeight: 800, color: "#38bdf8" }}>
              Evaporation
            </span>
            <span style={{ fontSize: 48, color: "#ffffff" }}>➔</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#93c5fd" }}>
              Condensation
            </span>
            <span style={{ fontSize: 48, color: "#ffffff" }}>➔</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#60a5fa" }}>
              Precipitation
            </span>
            <span style={{ fontSize: 48, color: "#ffffff" }}>➔</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: "#38bdf8" }}>
              Collection
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};