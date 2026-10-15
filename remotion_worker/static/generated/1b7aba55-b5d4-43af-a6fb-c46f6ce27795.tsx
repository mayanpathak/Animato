import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const DURATION_SECONDS = 28;

// Colors
const BG = "#090d16";
const TEXT_LIGHT = "#f8fafc";
const ACCENT_BLUE = "#38bdf8";
const ACCENT_ORANGE = "#fb923c";
const ACCENT_GREEN = "#34d399";
const ACCENT_RED = "#f43f5e";
const CARD_BG = "#1e293b";
const BORDER_COLOR = "#334155";

// SCENE 1: Introduction (Frames 0 to 120 = 6s)
const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const subtitleOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const elementsFade = interpolate(frame, [40, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const elementsSlide = interpolate(frame, [40, 60], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: TEXT_LIGHT,
        padding: "0 100px",
      }}
    >
      <div
        style={{
          transform: `scale(${titleScale})`,
          fontSize: 100,
          fontWeight: 900,
          letterSpacing: "-2px",
          textAlign: "center",
          color: ACCENT_BLUE,
          textTransform: "uppercase",
        }}
      >
        Game Theory
      </div>

      <div
        style={{
          opacity: subtitleOpacity,
          fontSize: 48,
          fontWeight: 500,
          color: "#94a3b8",
          marginTop: 20,
          textAlign: "center",
        }}
      >
        The Math of Strategic Decision Making
      </div>

      <div
        style={{
          opacity: elementsFade,
          transform: `translateY(${elementsSlide}px)`,
          display: "flex",
          gap: 40,
          marginTop: 90,
        }}
      >
        {[
          { label: "1. PLAYERS", desc: "Rational actors", col: ACCENT_BLUE },
          { label: "2. ACTIONS", desc: "Available choices", col: ACCENT_ORANGE },
          { label: "3. PAYOFFS", desc: "Outcomes & rewards", col: ACCENT_GREEN },
        ].map((item, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: CARD_BG,
              border: `4px solid ${item.col}`,
              borderRadius: 24,
              padding: "36px 44px",
              width: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 800, color: item.col }}>
              {item.label}
            </div>
            <div style={{ fontSize: 36, color: "#cbd5e1", marginTop: 12 }}>
              {item.desc}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// SCENE 2: The Payoff Matrix / Dilemma Setup (Frames 120 to 260 = 7s)
const SceneMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerSpring = spring({ frame, fps, config: { damping: 15 } });
  const tableOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: TEXT_LIGHT,
        alignItems: "center",
        paddingTop: 80,
      }}
    >
      <div
        style={{
          transform: `scale(${headerSpring})`,
          fontSize: 68,
          fontWeight: 800,
          color: TEXT_LIGHT,
          marginBottom: 10,
        }}
      >
        The Classic Dilemma: <span style={{ color: ACCENT_ORANGE }}>Cooperate</span> or{" "}
        <span style={{ color: ACCENT_RED }}>Betray</span>?
      </div>
      <div style={{ fontSize: 38, color: "#94a3b8", marginBottom: 50 }}>
        Two suspects questioned separately. Years in prison shown below:
      </div>

      <div
        style={{
          opacity: tableOpacity,
          position: "relative",
          width: 1100,
          height: 600,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Top Header: Player 2 */}
        <div style={{ display: "flex", marginLeft: 260, marginBottom: 20 }}>
          <div
            style={{
              width: 400,
              textAlign: "center",
              fontSize: 36,
              fontWeight: 700,
              color: ACCENT_GREEN,
            }}
          >
            Player B: Cooperate
          </div>
          <div
            style={{
              width: 400,
              textAlign: "center",
              fontSize: 36,
              fontWeight: 700,
              color: ACCENT_RED,
            }}
          >
            Player B: Betray
          </div>
        </div>

        {/* Matrix Rows */}
        <div style={{ display: "flex", height: 230, marginBottom: 24 }}>
          <div
            style={{
              width: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 30,
              fontSize: 36,
              fontWeight: 700,
              color: ACCENT_GREEN,
              textAlign: "right",
            }}
          >
            Player A:<br />Cooperate
          </div>
          <div
            style={{
              width: 400,
              backgroundColor: CARD_BG,
              borderRadius: 20,
              border: `4px solid ${BORDER_COLOR}`,
              marginRight: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 34, color: "#94a3b8" }}>Both stay silent</div>
            <div style={{ fontSize: 50, fontWeight: 900, color: ACCENT_GREEN, marginTop: 10 }}>
              -1 yr , -1 yr
            </div>
          </div>
          <div
            style={{
              width: 400,
              backgroundColor: CARD_BG,
              borderRadius: 20,
              border: `4px solid ${BORDER_COLOR}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 34, color: "#94a3b8" }}>A silent, B snitches</div>
            <div style={{ fontSize: 50, fontWeight: 900, marginTop: 10 }}>
              <span style={{ color: ACCENT_RED }}>-10 yrs</span> ,{" "}
              <span style={{ color: ACCENT_GREEN }}>0 yrs</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", height: 230 }}>
          <div
            style={{
              width: 240,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 30,
              fontSize: 36,
              fontWeight: 700,
              color: ACCENT_RED,
              textAlign: "right",
            }}
          >
            Player A:<br />Betray
          </div>
          <div
            style={{
              width: 400,
              backgroundColor: CARD_BG,
              borderRadius: 20,
              border: `4px solid ${BORDER_COLOR}`,
              marginRight: 24,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 34, color: "#94a3b8" }}>A snitches, B silent</div>
            <div style={{ fontSize: 50, fontWeight: 900, marginTop: 10 }}>
              <span style={{ color: ACCENT_GREEN }}>0 yrs</span> ,{" "}
              <span style={{ color: ACCENT_RED }}>-10 yrs</span>
            </div>
          </div>
          <div
            style={{
              width: 400,
              backgroundColor: CARD_BG,
              borderRadius: 20,
              border: `4px solid ${BORDER_COLOR}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 34, color: "#94a3b8" }}>Both snitch</div>
            <div style={{ fontSize: 50, fontWeight: 900, color: ACCENT_RED, marginTop: 10 }}>
              -5 yrs , -5 yrs
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 3: Nash Equilibrium Revealed (Frames 260 to 410 = 7.5s)
const SceneNash: React.FC = () => {
  const frame = useCurrentFrame();

  const highlightScale = interpolate(frame, [25, 45], [1, 1.06], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  const arrowPulse = interpolate(frame % 30, [0, 15, 30], [0, 10, 0]);

  const calloutOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: TEXT_LIGHT,
        alignItems: "center",
        paddingTop: 70,
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 900, color: ACCENT_BLUE }}>
        Nash Equilibrium
      </div>
      <div style={{ fontSize: 40, color: "#cbd5e1", marginTop: 12 }}>
        No player can unilaterally improve their outcome by switching.
      </div>

      <div
        style={{
          marginTop: 60,
          display: "flex",
          width: 1400,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Left side: Highlighted Matrix Focus */}
        <div style={{ width: 620, display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              backgroundColor: CARD_BG,
              borderRadius: 24,
              border: `4px dashed #64748b`,
              padding: "26px 36px",
              opacity: 0.5,
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 700, color: ACCENT_GREEN }}>
              Mutual Cooperation: (-1, -1)
            </div>
            <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 6 }}>
              Socially optimal, but unstable!
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#2a1523",
              borderRadius: 24,
              border: `6px solid ${ACCENT_RED}`,
              padding: "36px",
              transform: `scale(${highlightScale})`,
              boxShadow: `0 0 50px rgba(244, 63, 94, 0.4)`,
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 900, color: ACCENT_RED }}>
              Mutual Defection: (-5, -5)
            </div>
            <div style={{ fontSize: 32, color: "#fecdd3", marginTop: 14 }}>
              Whatever Player B does, Player A is strictly better off defecting!
            </div>
          </div>
        </div>

        {/* Right side: Explanation Banner */}
        <div
          style={{
            width: 700,
            opacity: calloutOpacity,
            transform: `translateY(${-arrowPulse}px)`,
            backgroundColor: "#0f233a",
            borderRadius: 28,
            border: `4px solid ${ACCENT_BLUE}`,
            padding: 44,
          }}
        >
          <div style={{ fontSize: 46, fontWeight: 800, color: ACCENT_BLUE, marginBottom: 20 }}>
            The Paradox of Rationality
          </div>
          <div style={{ fontSize: 36, lineHeight: 1.5, color: "#e2e8f0" }}>
            Individual self-interest leads both players to a <strong>worse collective result</strong>.
            <br />
            <br />
            This explains price wars, arms races, and climate dilemmas worldwide.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// SCENE 4: Summary & Real World Takeaway (Frames 410 to 560 = 7.5s)
const SceneSummary: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainScale = spring({ frame, fps, config: { damping: 14 } });
  const itemsFade = interpolate(frame, [20, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: TEXT_LIGHT,
        alignItems: "center",
        justifyContent: "center",
        padding: "0 100px",
      }}
    >
      <div
        style={{
          transform: `scale(${mainScale})`,
          textAlign: "center",
          marginBottom: 60,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: "4px",
            color: ACCENT_BLUE,
            textTransform: "uppercase",
          }}
        >
          Key Takeaway
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 900,
            lineHeight: 1.2,
            marginTop: 15,
            maxWidth: 1500,
          }}
        >
          "Your best move depends on what everyone else chooses."
        </div>
      </div>

      <div
        style={{
          opacity: itemsFade,
          display: "flex",
          gap: 40,
          width: "100%",
          justifyContent: "center",
        }}
      >
        {[
          { label: "Economics", desc: "Pricing, auctions, and market monopolies" },
          { label: "Evolution", desc: "Cooperation and survival strategies" },
          { label: "AI & Tech", desc: "Multi-agent systems & cybersecurity" },
        ].map((app, index) => (
          <div
            key={index}
            style={{
              backgroundColor: CARD_BG,
              borderRadius: 24,
              border: `4px solid ${BORDER_COLOR}`,
              padding: "36px 32px",
              width: 440,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44, fontWeight: 800, color: ACCENT_ORANGE }}>
              {app.label}
            </div>
            <div style={{ fontSize: 32, color: "#94a3b8", marginTop: 14 }}>
              {app.desc}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const GeneratedScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* 20 fps * 28 seconds = 560 frames */}
      <Sequence from={0} durationInFrames={120}>
        <SceneIntro />
      </Sequence>

      <Sequence from={120} durationInFrames={140}>
        <SceneMatrix />
      </Sequence>

      <Sequence from={260} durationInFrames={150}>
        <SceneNash />
      </Sequence>

      <Sequence from={410} durationInFrames={150}>
        <SceneSummary />
      </Sequence>
    </AbsoluteFill>
  );
};