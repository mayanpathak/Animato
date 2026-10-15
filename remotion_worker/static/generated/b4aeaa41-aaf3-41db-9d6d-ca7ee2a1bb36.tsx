import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  Easing,
  spring,
} from "remotion";

export const DURATION_SECONDS = 36;

// Fixed starfield background
const StarField: React.FC = () => {
  const stars = useMemo(() => {
    return Array.from({ length: 75 }).map((_, i) => ({
      id: i,
      x: ((i * 137.5) % 1900) + 10,
      y: ((i * 271.3) % 1060) + 10,
      size: (i % 3) * 2 + 3,
      opacity: 0.3 + ((i % 5) * 0.14),
    }));
  }, []);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            opacity: s.opacity,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// 3D Sphere Renderer with pseudo-lighting
const Sphere3D: React.FC<{
  size: number;
  baseColor: string;
  highlightColor: string;
  shadowColor: string;
  glowColor?: string;
  glowSize?: number;
  style?: React.CSSProperties;
}> = ({
  size,
  baseColor,
  highlightColor,
  shadowColor,
  glowColor,
  glowSize = 40,
  style,
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 30%, ${highlightColor} 0%, ${baseColor} 50%, ${shadowColor} 100%)`,
        boxShadow: glowColor
          ? `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 2}px ${glowColor}`
          : `inset -${size * 0.15}px -${size * 0.15}px ${size * 0.3}px rgba(0,0,0,0.8)`,
        ...style,
      }}
    />
  );
};

// Scene 1: Introduction Title
const SceneTitle: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [0, 20], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const sunScale = interpolate(frame, [10, 40], [0.6, 1], {
    easing: Easing.out(Easing.back(1.5)),
    extrapolateRight: "clamp",
  });

  const angle = (frame * 0.04) % (Math.PI * 2);
  const orbitX = Math.cos(angle) * 380;
  const orbitY = Math.sin(angle) * 110;
  const earthScale = interpolate(Math.sin(angle), [-1, 1], [0.8, 1.2]);
  const isEarthBehind = Math.sin(angle) < 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050713",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <StarField />

      {/* Header Text */}
      <div
        style={{
          position: "absolute",
          top: 90,
          textAlign: "center",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 94,
            fontWeight: 900,
            color: "#f8fafc",
            letterSpacing: "4px",
            textShadow: "0 8px 30px rgba(255,180,0,0.3)",
          }}
        >
          LIFECYCLE OF SUN & EARTH
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 600,
            color: "#38bdf8",
            marginTop: 20,
            opacity: subOpacity,
          }}
        >
          From Nebula Cloud to White Dwarf Remnant
        </div>
      </div>

      {/* 3D Orbit Visual */}
      <div
        style={{
          position: "absolute",
          top: 610,
          left: 960,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Orbit ellipse path */}
        <svg
          width="900"
          height="320"
          style={{
            position: "absolute",
            left: -450,
            top: -160,
            pointerEvents: "none",
          }}
        >
          <ellipse
            cx="450"
            cy="160"
            rx="380"
            ry="110"
            fill="none"
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="6"
            strokeDasharray="16 12"
          />
        </svg>

        {/* Earth behind Sun */}
        {isEarthBehind && (
          <div
            style={{
              position: "absolute",
              left: orbitX - 35,
              top: orbitY - 35,
              transform: `scale(${earthScale})`,
            }}
          >
            <Sphere3D
              size={70}
              baseColor="#0284c7"
              highlightColor="#38bdf8"
              shadowColor="#082f49"
              glowColor="rgba(56,189,248,0.5)"
              glowSize={25}
            />
          </div>
        )}

        {/* Center Sun */}
        <div
          style={{
            position: "absolute",
            left: -120,
            top: -120,
            transform: `scale(${sunScale})`,
          }}
        >
          <Sphere3D
            size={240}
            baseColor="#ea580c"
            highlightColor="#fef08a"
            shadowColor="#7c2d12"
            glowColor="rgba(251, 146, 60, 0.85)"
            glowSize={90}
          />
        </div>

        {/* Earth in front of Sun */}
        {!isEarthBehind && (
          <div
            style={{
              position: "absolute",
              left: orbitX - 35,
              top: orbitY - 35,
              transform: `scale(${earthScale})`,
            }}
          >
            <Sphere3D
              size={70}
              baseColor="#0284c7"
              highlightColor="#38bdf8"
              shadowColor="#082f49"
              glowColor="rgba(56,189,248,0.5)"
              glowSize={25}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Scene 2: Solar Nebula & Formation
const SceneNebula: React.FC = () => {
  const frame = useCurrentFrame();

  const titleFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textFade = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const diskRotation = frame * 1.8;
  const collapse = interpolate(frame, [0, 120], [1.4, 0.95], {
    easing: Easing.inOut(Easing.quad),
  });
  const coreBrightness = interpolate(frame, [20, 100], [0.3, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#070817",
        justifyContent: "flex-start",
        padding: "80px 100px",
      }}
    >
      <StarField />

      {/* Narrative Label */}
      <div style={{ opacity: titleFade, zIndex: 10 }}>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 92,
            fontWeight: 900,
            color: "#fdba74",
            textTransform: "uppercase",
          }}
        >
          1. Cosmic Dawn (4.6B Yrs Ago)
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 500,
            color: "#e2e8f0",
            marginTop: 18,
            lineHeight: 1.35,
            opacity: textFade,
            maxWidth: 1600,
          }}
        >
          A giant molecular gas cloud collapses under gravity, spinning into an
          accretion disk to birth the young Sun & rocky protoplanets.
        </div>
      </div>

      {/* 3D Nebula Accretion Disk */}
      <div
        style={{
          position: "absolute",
          top: 660,
          left: 960,
          transform: `translate(-50%, -50%) scale(${collapse})`,
        }}
      >
        <svg
          width="1100"
          height="450"
          style={{
            transform: `rotate(${diskRotation}deg) scale(1, 0.45)`,
            transformOrigin: "center center",
          }}
        >
          <defs>
            <radialGradient id="nebulaGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffedd5" stopOpacity="1" />
              <stop offset="25%" stopColor="#f97316" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="550" cy="225" rx="520" ry="200" fill="url(#nebulaGrad)" />
          {/* Dust streaks */}
          <circle
            cx="550"
            cy="225"
            r="420"
            stroke="rgba(254, 215, 170, 0.4)"
            strokeWidth="12"
            fill="none"
            strokeDasharray="40 60"
          />
          <circle
            cx="550"
            cy="225"
            r="300"
            stroke="rgba(249, 115, 22, 0.6)"
            strokeWidth="16"
            fill="none"
            strokeDasharray="30 40"
          />
        </svg>

        {/* Protostar Core */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: -100,
            opacity: coreBrightness,
          }}
        >
          <Sphere3D
            size={200}
            baseColor="#f97316"
            highlightColor="#ffffff"
            shadowColor="#7c2d12"
            glowColor="rgba(255, 170, 50, 0.9)"
            glowSize={110}
          />
        </div>

        {/* Accreting Proto-Earth */}
        <div
          style={{
            position: "absolute",
            top: -30,
            left: 320,
          }}
        >
          <Sphere3D
            size={60}
            baseColor="#9a3412"
            highlightColor="#fed7aa"
            shadowColor="#431407"
            glowColor="rgba(234, 88, 12, 0.6)"
            glowSize={30}
          />
          <span
            style={{
              position: "absolute",
              top: 75,
              left: -40,
              fontFamily: "sans-serif",
              fontSize: 44,
              fontWeight: 700,
              color: "#ffedd5",
              whiteSpace: "nowrap",
            }}
          >
            Proto-Earth
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Main Sequence (The Present Day)
const SceneMainSequence: React.FC = () => {
  const frame = useCurrentFrame();

  const titleFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textFade = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const angle = (frame * 0.05) % (Math.PI * 2);
  const orbitX = Math.cos(angle) * 440;
  const orbitY = Math.sin(angle) * 130;
  const earthScale = interpolate(Math.sin(angle), [-1, 1], [0.85, 1.25]);
  const isEarthBehind = Math.sin(angle) < 0;

  // Gentle solar pulse
  const sunPulse = 1 + Math.sin(frame * 0.15) * 0.025;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#030712",
        padding: "80px 100px",
      }}
    >
      <StarField />

      {/* Narrative Label */}
      <div style={{ opacity: titleFade, zIndex: 10 }}>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 92,
            fontWeight: 900,
            color: "#38bdf8",
            textTransform: "uppercase",
          }}
        >
          2. Main Sequence: Present Era
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 500,
            color: "#f1f5f9",
            marginTop: 18,
            lineHeight: 1.35,
            opacity: textFade,
            maxWidth: 1650,
          }}
        >
          Hydrogen fusion sustains the Sun's equilibrium for 10 billion years.
          Earth flourishes safely within the temperate Goldilocks Zone.
        </div>
      </div>

      {/* 3D System View */}
      <div
        style={{
          position: "absolute",
          top: 660,
          left: 960,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Orbital Track */}
        <svg
          width="1040"
          height="360"
          style={{
            position: "absolute",
            left: -520,
            top: -180,
            pointerEvents: "none",
          }}
        >
          <ellipse
            cx="520"
            cy="180"
            rx="440"
            ry="130"
            fill="none"
            stroke="rgba(56, 189, 248, 0.45)"
            strokeWidth="7"
          />
        </svg>

        {/* Earth behind Sun */}
        {isEarthBehind && (
          <div
            style={{
              position: "absolute",
              left: orbitX - 40,
              top: orbitY - 40,
              transform: `scale(${earthScale})`,
            }}
          >
            <Sphere3D
              size={80}
              baseColor="#0284c7"
              highlightColor="#6ee7b7"
              shadowColor="#082f49"
              glowColor="rgba(56, 189, 248, 0.7)"
              glowSize={35}
            />
          </div>
        )}

        {/* Main Sequence Sun */}
        <div
          style={{
            position: "absolute",
            left: -125,
            top: -125,
            transform: `scale(${sunPulse})`,
          }}
        >
          <Sphere3D
            size={250}
            baseColor="#f59e0b"
            highlightColor="#fef08a"
            shadowColor="#b45309"
            glowColor="rgba(250, 204, 21, 0.9)"
            glowSize={110}
          />
          <div
            style={{
              position: "absolute",
              top: 265,
              left: 5,
              width: 240,
              textAlign: "center",
              fontFamily: "sans-serif",
              fontSize: 48,
              fontWeight: 800,
              color: "#fef08a",
            }}
          >
            Stable Sun
          </div>
        </div>

        {/* Earth in front of Sun */}
        {!isEarthBehind && (
          <div
            style={{
              position: "absolute",
              left: orbitX - 40,
              top: orbitY - 40,
              transform: `scale(${earthScale})`,
            }}
          >
            <Sphere3D
              size={80}
              baseColor="#0284c7"
              highlightColor="#6ee7b7"
              shadowColor="#082f49"
              glowColor="rgba(56, 189, 248, 0.7)"
              glowSize={35}
            />
            <div
              style={{
                position: "absolute",
                top: 92,
                left: -35,
                width: 150,
                textAlign: "center",
                fontFamily: "sans-serif",
                fontSize: 48,
                fontWeight: 800,
                color: "#38bdf8",
              }}
            >
              Living Earth
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: Red Giant Expansion
const SceneRedGiant: React.FC = () => {
  const frame = useCurrentFrame();

  const titleFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textFade = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Sun swelling from 240px to 620px
  const sunSize = interpolate(frame, [0, 110], [250, 620], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  // Earth scorched state
  const earthScorched = interpolate(frame, [30, 90], [0, 1], {
    extrapolateRight: "clamp",
  });

  const angle = (frame * 0.04) % (Math.PI * 2);
  const orbitX = Math.cos(angle) * 440;
  const orbitY = Math.sin(angle) * 130;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#160505",
        padding: "80px 100px",
      }}
    >
      <StarField />

      {/* Narrative Label */}
      <div style={{ opacity: titleFade, zIndex: 10 }}>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 92,
            fontWeight: 900,
            color: "#f87171",
            textTransform: "uppercase",
          }}
        >
          3. Red Giant Phase (+5B Yrs)
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 500,
            color: "#fee2e2",
            marginTop: 18,
            lineHeight: 1.35,
            opacity: textFade,
            maxWidth: 1650,
          }}
        >
          Exhausting its core hydrogen, the Sun expands hundreds of times over,
          vaporizing oceans and scorching Earth's surface into magma.
        </div>
      </div>

      {/* Center expanding giant Sun */}
      <div
        style={{
          position: "absolute",
          top: 670,
          left: 960,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -sunSize / 2,
            top: -sunSize / 2,
          }}
        >
          <Sphere3D
            size={sunSize}
            baseColor="#dc2626"
            highlightColor="#fca5a5"
            shadowColor="#450a0a"
            glowColor="rgba(239, 68, 68, 0.85)"
            glowSize={140}
          />
        </div>

        {/* Orbit ring entering danger zone */}
        <svg
          width="1040"
          height="360"
          style={{
            position: "absolute",
            left: -520,
            top: -180,
            pointerEvents: "none",
          }}
        >
          <ellipse
            cx="520"
            cy="180"
            rx="440"
            ry="130"
            fill="none"
            stroke="rgba(248, 113, 113, 0.4)"
            strokeWidth="7"
            strokeDasharray="20 15"
          />
        </svg>

        {/* Scorched Earth */}
        <div
          style={{
            position: "absolute",
            left: orbitX - 35,
            top: orbitY - 35,
          }}
        >
          <Sphere3D
            size={70}
            baseColor={earthScorched > 0.5 ? "#7f1d1d" : "#0284c7"}
            highlightColor={earthScorched > 0.5 ? "#f97316" : "#38bdf8"}
            shadowColor="#2b0707"
            glowColor="rgba(234, 88, 12, 0.9)"
            glowSize={35}
          />
          <div
            style={{
              position: "absolute",
              top: 80,
              left: -40,
              width: 150,
              textAlign: "center",
              fontFamily: "sans-serif",
              fontSize: 44,
              fontWeight: 800,
              color: "#fb923c",
            }}
          >
            Scorched
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: White Dwarf & Planetary Nebula
const SceneWhiteDwarf: React.FC = () => {
  const frame = useCurrentFrame();

  const titleFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: "clamp",
  });
  const textFade = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Outer shell ejected outward
  const shellRadius = interpolate(frame, [0, 100], [180, 520], {
    easing: Easing.out(Easing.cubic),
  });
  const shellOpacity = interpolate(frame, [0, 80], [0.85, 0.25]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#040510",
        padding: "80px 100px",
      }}
    >
      <StarField />

      {/* Narrative Label */}
      <div style={{ opacity: titleFade, zIndex: 10 }}>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 92,
            fontWeight: 900,
            color: "#a5f3fc",
            textTransform: "uppercase",
          }}
        >
          4. Planetary Nebula & White Dwarf
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontSize: 52,
            fontWeight: 500,
            color: "#f8fafc",
            marginTop: 18,
            lineHeight: 1.35,
            opacity: textFade,
            maxWidth: 1650,
          }}
        >
          Outer layers disperse into a colorful glowing nebula, leaving behind
          an Earth-sized, ultra-dense White Dwarf to cool over trillions of years.
        </div>
      </div>

      {/* Expanding Nebula Ring and White Dwarf */}
      <div
        style={{
          position: "absolute",
          top: 660,
          left: 960,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Glowing Planetary Nebula Shell */}
        <div
          style={{
            position: "absolute",
            left: -shellRadius,
            top: -shellRadius * 0.45,
            width: shellRadius * 2,
            height: shellRadius * 0.9,
            borderRadius: "50%",
            border: "18px solid rgba(56, 189, 248, 0.8)",
            boxShadow:
              "0 0 80px rgba(168, 85, 247, 0.6), inset 0 0 80px rgba(56, 189, 248, 0.6)",
            opacity: shellOpacity,
            transform: "rotate(-15deg)",
          }}
        />

        {/* Dense White Dwarf */}
        <div
          style={{
            position: "absolute",
            left: -40,
            top: -40,
          }}
        >
          <Sphere3D
            size={80}
            baseColor="#e0f2fe"
            highlightColor="#ffffff"
            shadowColor="#0369a1"
            glowColor="rgba(255, 255, 255, 1)"
            glowSize={75}
          />
          <div
            style={{
              position: "absolute",
              top: 100,
              left: -80,
              width: 240,
              textAlign: "center",
              fontFamily: "sans-serif",
              fontSize: 48,
              fontWeight: 800,
              color: "#a5f3fc",
            }}
          >
            White Dwarf
          </div>
        </div>

        {/* Frozen Cinder Remnant */}
        <div
          style={{
            position: "absolute",
            left: 420,
            top: -25,
          }}
        >
          <Sphere3D
            size={50}
            baseColor="#334155"
            highlightColor="#64748b"
            shadowColor="#0f172a"
          />
          <div
            style={{
              position: "absolute",
              top: 65,
              left: -50,
              width: 150,
              textAlign: "center",
              fontFamily: "sans-serif",
              fontSize: 44,
              fontWeight: 700,
              color: "#94a3b8",
            }}
          >
            Frozen Core
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const GeneratedScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#02040a" }}>
      {/* 0s - 6s: Title / Overview */}
      <Sequence from={0} durationInFrames={120}>
        <SceneTitle />
      </Sequence>

      {/* 6s - 14s: Solar Nebula Formation */}
      <Sequence from={120} durationInFrames={160}>
        <SceneNebula />
      </Sequence>

      {/* 14s - 22s: Main Sequence (Today) */}
      <Sequence from={280} durationInFrames={160}>
        <SceneMainSequence />
      </Sequence>

      {/* 22s - 30s: Red Giant Stage */}
      <Sequence from={440} durationInFrames={160}>
        <SceneRedGiant />
      </Sequence>

      {/* 30s - 36s: White Dwarf & Remnant */}
      <Sequence from={600} durationInFrames={120}>
        <SceneWhiteDwarf />
      </Sequence>
    </AbsoluteFill>
  );
};