import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
  Sequence,
} from "remotion";

export const DURATION_SECONDS = 30;

interface ParticleDef {
  id: number;
  row: number;
  col: number;
  seed: number;
  gasVx: number;
  gasVy: number;
  gasStartX: number;
  gasStartY: number;
}

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 25 deterministic particles for solid/liquid/gas microscopic view
  const particles: ParticleDef[] = useMemo(() => {
    const list: ParticleDef[] = [];
    let id = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const seed = (id * 9301 + 49297) % 233280;
        const norm = seed / 233280;
        const norm2 = ((seed * 7) % 233280) / 233280;
        list.push({
          id,
          row: r,
          col: c,
          seed: norm,
          gasVx: (norm - 0.5) * 6,
          gasVy: (norm2 - 0.5) * 6,
          gasStartX: 40 + norm * 260,
          gasStartY: 40 + norm2 * 260,
        });
        id++;
      }
    }
    return list;
  }, []);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#F4F8FC",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* SCENE 0: INTRO TITLE (0 to 3.5s / frames 0 - 105) */}
      <Sequence from={0} durationInFrames={105}>
        <IntroScene />
      </Sequence>

      {/* MAIN DEMO & TRANSFORMATION (frames 95 - 760, ~22s) */}
      <Sequence from={95} durationInFrames={675}>
        <InteractiveLesson frame={frame - 95} fps={fps} particles={particles} />
      </Sequence>

      {/* SUMMARY RECAP (frames 760 - 900, ~4.7s) */}
      <Sequence from={760} durationInFrames={140}>
        <SummaryScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ==========================================
// 1. INTRO TITLE CARD
// ==========================================
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titlePop = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const subtitleFade = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [85, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          padding: "60px 100px",
          borderRadius: "36px",
          boxShadow: "0 24px 60px rgba(2, 132, 199, 0.18)",
          textAlign: "center",
          border: "4px solid #0284C7",
          transform: `scale(${titlePop})`,
        }}
      >
        <div
          style={{
            fontSize: "48px",
            fontWeight: 800,
            color: "#0369A1",
            textTransform: "uppercase",
            letterSpacing: "4px",
            marginBottom: "16px",
          }}
        >
          Class 6 Science
        </div>
        <div
          style={{
            fontSize: "88px",
            fontWeight: 900,
            color: "#0F172A",
            marginBottom: "24px",
            lineHeight: 1.1,
          }}
        >
          Three States of Matter
        </div>
        <div
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "#2563EB",
            opacity: subtitleFade,
          }}
        >
          Solid • Liquid • Gas
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 2. MAIN INTERACTIVE LESSON
// ==========================================
interface LessonProps {
  frame: number;
  fps: number;
  particles: ParticleDef[];
}

const InteractiveLesson: React.FC<LessonProps> = ({ frame, fps, particles }) => {
  // TIMINGS (relative to interactive lesson start)
  // Phase 1: SOLID (Ice)   -> 0 to 220 (~7.3s)
  // Melting Transition     -> 200 to 260
  // Phase 2: LIQUID (Water)-> 240 to 450 (~7s)
  // Boiling Transition     -> 430 to 490
  // Phase 3: GAS (Steam)   -> 470 to 675 (~6.8s)

  const isSolid = frame < 220;
  const isLiquid = frame >= 220 && frame < 450;
  const isGas = frame >= 450;

  // Global fade-in
  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  // State interpolation factors [0 = Solid, 1 = Liquid, 2 = Gas]
  const heatStage = interpolate(
    frame,
    [0, 210, 260, 440, 500, 675],
    [0, 0, 1, 1, 2, 2],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Beaker and heat properties
  const flameIntensity = interpolate(
    frame,
    [160, 220, 440, 510],
    [0, 0.7, 0.7, 1.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Ice cube size (melts away into beaker pool)
  const iceCubeScale = interpolate(frame, [190, 270], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Water level in beaker
  const waterLevel = interpolate(
    frame,
    [190, 270, 500, 660],
    [0, 120, 120, 30],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Active state header badge
  const activeIndex = isSolid ? 0 : isLiquid ? 1 : 2;

  return (
    <AbsoluteFill
      style={{
        opacity: sceneOpacity,
        padding: "40px 80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* TOP HEADER: STATE INDICATORS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
        }}
      >
        <div style={{ fontSize: "80px", fontWeight: 900, color: "#0F172A" }}>
          {isSolid && "1. SOLID (Ice)"}
          {isLiquid && "2. LIQUID (Water)"}
          {isGas && "3. GAS (Steam)"}
        </div>

        {/* 3 Steps Pills */}
        <div style={{ display: "flex", gap: "20px" }}>
          {[
            { name: "SOLID", color: "#0284C7" },
            { name: "LIQUID", color: "#2563EB" },
            { name: "GAS", color: "#D97706" },
          ].map((pill, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={pill.name}
                style={{
                  padding: "16px 36px",
                  borderRadius: "999px",
                  fontSize: "44px",
                  fontWeight: 800,
                  backgroundColor: isActive ? pill.color : "#E2E8F0",
                  color: isActive ? "#FFFFFF" : "#64748B",
                  boxShadow: isActive
                    ? "0 8px 24px rgba(0,0,0,0.15)"
                    : "none",
                  transform: isActive ? "scale(1.05)" : "scale(1)",
                  transition: "all 0.3s ease",
                }}
              >
                {pill.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN DISPLAY AREA: LEFT = MACRO BEAKER, RIGHT = MICRO PARTICLES */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "680px",
          width: "100%",
          gap: "60px",
        }}
      >
        {/* LEFT CARD: PHYSICAL CONTAINER / APPARATUS */}
        <div
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "32px",
            border: "4px solid #E2E8F0",
            boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: "40px",
              fontSize: "44px",
              fontWeight: 800,
              color: "#334155",
            }}
          >
            Observation:
          </div>

          {/* APPARATUS DRAWING (BEAKER, ICE, WATER, HEAT, STEAM) */}
          <div
            style={{
              position: "relative",
              width: "440px",
              height: "460px",
              marginTop: "40px",
            }}
          >
            {/* STEAM RISING (Visible during gas phase) */}
            {heatStage > 1.2 && (
              <svg
                width="440"
                height="180"
                style={{
                  position: "absolute",
                  top: "-120px",
                  left: 0,
                  pointerEvents: "none",
                }}
              >
                {[60, 140, 220, 300, 380].map((xPos, idx) => {
                  const steamY = ((frame * 4 + idx * 45) % 180);
                  const steamAlpha = interpolate(steamY, [0, 90, 180], [0, 0.8, 0]);
                  return (
                    <circle
                      key={idx}
                      cx={xPos + Math.sin((frame + idx * 30) * 0.1) * 20}
                      cy={180 - steamY}
                      r={24 + (steamY / 180) * 28}
                      fill="#94A3B8"
                      opacity={steamAlpha}
                    />
                  );
                })}
              </svg>
            )}

            {/* BEAKER OUTLINE */}
            <svg
              width="440"
              height="360"
              viewBox="0 0 440 360"
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Liquid Water Pool inside beaker */}
              {waterLevel > 2 && (
                <rect
                  x="74"
                  y={320 - waterLevel}
                  width="292"
                  height={waterLevel}
                  fill="#38BDF8"
                  opacity={0.85}
                  rx="10"
                />
              )}

              {/* Boiling bubbles inside water when hot */}
              {heatStage > 1.3 &&
                waterLevel > 15 &&
                [100, 160, 220, 280, 340].map((bx, bidx) => {
                  const bProgress = (frame * 5 + bidx * 37) % waterLevel;
                  return (
                    <circle
                      key={bidx}
                      cx={bx}
                      cy={320 - bProgress}
                      r={7 + (bidx % 3) * 3}
                      fill="#E0F2FE"
                      stroke="#0284C7"
                      strokeWidth="2"
                    />
                  );
                })}

              {/* Beaker Glass Body */}
              <path
                d="M 60 30 L 70 330 Q 70 340 85 340 L 355 340 Q 370 340 370 330 L 380 30"
                fill="none"
                stroke="#64748B"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Measurement marks */}
              <line x1="75" y1="120" x2="110" y2="120" stroke="#94A3B8" strokeWidth="4" />
              <line x1="75" y1="180" x2="130" y2="180" stroke="#94A3B8" strokeWidth="6" />
              <line x1="75" y1="240" x2="110" y2="240" stroke="#94A3B8" strokeWidth="4" />
              {/* Beaker Lip */}
              <path
                d="M 50 30 L 65 30 M 375 30 L 390 30"
                stroke="#64748B"
                strokeWidth="10"
                strokeLinecap="round"
              />
            </svg>

            {/* ICE CUBE (Centered inside beaker, scales down on melting) */}
            {iceCubeScale > 0.01 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "35px",
                  left: "140px",
                  width: "160px",
                  height: "160px",
                  backgroundColor: "rgba(186, 230, 253, 0.95)",
                  border: "5px solid #38BDF8",
                  borderRadius: "24px",
                  boxShadow: "inset 0 0 20px rgba(2, 132, 199, 0.3)",
                  transform: `scale(${iceCubeScale})`,
                  transformOrigin: "bottom center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "44px",
                    fontWeight: 900,
                    color: "#0369A1",
                  }}
                >
                  ICE
                </span>
              </div>
            )}

            {/* BURNER FLAME UNDER BEAKER */}
            {flameIntensity > 0.05 && (
              <div
                style={{
                  position: "absolute",
                  bottom: "-65px",
                  left: "185px",
                  transform: `scale(${flameIntensity})`,
                  transformOrigin: "bottom center",
                }}
              >
                <svg width="70" height="70" viewBox="0 0 100 100">
                  <path
                    d={`M 50 10 Q ${65 + Math.sin(frame * 0.8) * 8} 50 50 90 Q ${
                      35 - Math.sin(frame * 0.8) * 8
                    } 50 50 10 Z`}
                    fill="#F59E0B"
                  />
                  <path
                    d={`M 50 35 Q ${58 + Math.sin(frame * 0.8) * 5} 65 50 90 Q ${
                      42 - Math.sin(frame * 0.8) * 5
                    } 65 50 35 Z`}
                    fill="#EF4444"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Dynamic Status Text */}
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              fontSize: "44px",
              fontWeight: 800,
              color: "#0F172A",
            }}
          >
            {isSolid && "Fixed Shape • Firm Ice Cube"}
            {isLiquid && "Flows • Takes Shape of Beaker"}
            {isGas && "Boiling • Escapes as Steam"}
          </div>
        </div>

        {/* RIGHT CARD: MICROSCOPIC PARTICLE VIEW */}
        <div
          style={{
            flex: 1,
            height: "100%",
            backgroundColor: "#FFFFFF",
            borderRadius: "32px",
            border: "4px solid #E2E8F0",
            boxShadow: "0 16px 40px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "30px 40px",
          }}
        >
          <div
            style={{
              fontSize: "44px",
              fontWeight: 800,
              color: "#0F172A",
              textAlign: "center",
            }}
          >
            🔬 Particle View (Arrangement)
          </div>

          {/* CIRCULAR MAGNIFIER CONTAINER */}
          <div
            style={{
              width: "350px",
              height: "350px",
              borderRadius: "50%",
              backgroundColor: "#F8FAFC",
              border: "8px solid #0284C7",
              boxShadow: "inset 0 8px 24px rgba(0,0,0,0.08)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {particles.map((p) => {
              // SOLID POSITION (Tight regular grid with gentle vibration)
              const solidBaseX = 75 + p.col * 50;
              const solidBaseY = 75 + p.row * 50;
              const solidJitterX = Math.sin(frame * 0.45 + p.seed * 20) * 2.5;
              const solidJitterY = Math.cos(frame * 0.45 + p.seed * 30) * 2.5;
              const solidX = solidBaseX + solidJitterX;
              const solidY = solidBaseY + solidJitterY;

              // LIQUID POSITION (Close, settled in bottom pool, sliding smoothly)
              const liqRow = Math.floor(p.id / 5);
              const liqCol = p.id % 5;
              const liqBaseX = 65 + liqCol * 55;
              const liqBaseY = 160 + liqRow * 32;
              const liqFlowX = Math.sin(frame * 0.08 + p.seed * 10) * 16;
              const liqFlowY = Math.cos(frame * 0.07 + p.seed * 15) * 8;
              const liqX = liqBaseX + liqFlowX;
              const liqY = liqBaseY + liqFlowY;

              // GAS POSITION (Far apart, high velocity bouncing freely across full sphere)
              const speed = 7;
              const gasSpan = 270;
              const gasRawX = (p.gasStartX + p.gasVx * frame * 1.5) % gasSpan;
              const gasRawY = (p.gasStartY + p.gasVy * frame * 1.5) % gasSpan;
              const gasX = 40 + (gasRawX < 0 ? gasRawX + gasSpan : gasRawX);
              const gasY = 40 + (gasRawY < 0 ? gasRawY + gasSpan : gasRawY);

              // Smoothly interpolate between positions according to heatStage
              let posX = solidX;
              let posY = solidY;

              if (heatStage <= 1) {
                posX = interpolate(heatStage, [0, 1], [solidX, liqX]);
                posY = interpolate(heatStage, [0, 1], [solidY, liqY]);
              } else {
                posX = interpolate(heatStage, [1, 2], [liqX, gasX]);
                posY = interpolate(heatStage, [1, 2], [liqY, gasY]);
              }

              const particleColor =
                heatStage < 0.6
                  ? "#0284C7"
                  : heatStage < 1.5
                  ? "#2563EB"
                  : "#EA580C";

              return (
                <div
                  key={p.id}
                  style={{
                    position: "absolute",
                    left: `${posX}px`,
                    top: `${posY}px`,
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: particleColor,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              );
            })}
          </div>

          {/* PARTICLE EXPLANATION TEXT */}
          <div
            style={{
              fontSize: "44px",
              fontWeight: 800,
              color: isSolid ? "#0284C7" : isLiquid ? "#2563EB" : "#D97706",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            {isSolid && "Tightly packed • Vibrate in place"}
            {isLiquid && "Close together • Slide past each other"}
            {isGas && "Far apart • Move rapidly everywhere"}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ==========================================
// 3. FINAL SUMMARY RECAP SCENE
// ==========================================
const SummaryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        padding: "40px 80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        transform: `scale(${pop})`,
      }}
    >
      <div
        style={{
          fontSize: "80px",
          fontWeight: 900,
          color: "#0F172A",
          textAlign: "center",
        }}
      >
        Summary: Three States of Matter
      </div>

      {/* 3 SUMMARY CARDS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          gap: "40px",
          marginTop: "10px",
          marginBottom: "10px",
        }}
      >
        {/* Solid Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#F0F9FF",
            border: "5px solid #0284C7",
            borderRadius: "28px",
            padding: "36px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(2, 132, 199, 0.1)",
          }}
        >
          <div style={{ fontSize: "52px", fontWeight: 900, color: "#0284C7", marginBottom: "16px" }}>
            SOLID
          </div>
          <div style={{ fontSize: "44px", fontWeight: 700, color: "#1E293B", lineHeight: 1.3 }}>
            Tightly Packed
          </div>
          <div style={{ fontSize: "44px", color: "#475569", marginTop: "12px" }}>
            Fixed Shape & Volume
          </div>
        </div>

        {/* Liquid Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#EFF6FF",
            border: "5px solid #2563EB",
            borderRadius: "28px",
            padding: "36px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(37, 99, 235, 0.1)",
          }}
        >
          <div style={{ fontSize: "52px", fontWeight: 900, color: "#2563EB", marginBottom: "16px" }}>
            LIQUID
          </div>
          <div style={{ fontSize: "44px", fontWeight: 700, color: "#1E293B", lineHeight: 1.3 }}>
            Close & Free Flow
          </div>
          <div style={{ fontSize: "44px", color: "#475569", marginTop: "12px" }}>
            Takes Container Shape
          </div>
        </div>

        {/* Gas Card */}
        <div
          style={{
            flex: 1,
            backgroundColor: "#FFFBEB",
            border: "5px solid #D97706",
            borderRadius: "28px",
            padding: "36px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(217, 119, 6, 0.1)",
          }}
        >
          <div style={{ fontSize: "52px", fontWeight: 900, color: "#D97706", marginBottom: "16px" }}>
            GAS
          </div>
          <div style={{ fontSize: "44px", fontWeight: 700, color: "#1E293B", lineHeight: 1.3 }}>
            Far Apart & Fast
          </div>
          <div style={{ fontSize: "44px", color: "#475569", marginTop: "12px" }}>
            Fills Any Space
          </div>
        </div>
      </div>

      {/* HEAT ARROW FOOTER */}
      <div
        style={{
          width: "100%",
          backgroundColor: "#FEF2F2",
          border: "3px dashed #EF4444",
          borderRadius: "20px",
          padding: "16px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "44px", fontWeight: 800, color: "#DC2626" }}>
          Heat Added: Ice (Solid) ➔ Water (Liquid) ➔ Steam (Gas)
        </span>
      </div>
    </AbsoluteFill>
  );
};