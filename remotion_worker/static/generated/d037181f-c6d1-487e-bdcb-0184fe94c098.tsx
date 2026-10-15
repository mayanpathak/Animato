import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, interpolate, Easing } from "remotion";

export const DURATION_SECONDS = 35;

export const GeneratedScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", fontFamily: "sans-serif", color: "#ffffff" }}>
      {/* Scene 1: Title Card (0 - 6s / 0 - 120 frames) */}
      <Sequence from={0} durationInFrames={120}>
        <TitleScene />
      </Sequence>

      {/* Scene 2: What is Redis? (6 - 13s / 120 - 260 frames) */}
      <Sequence from={120} durationInFrames={140}>
        <DefinitionScene />
      </Sequence>

      {/* Scene 3: In-Memory Architecture (13 - 20s / 260 - 400 frames) */}
      <Sequence from={260} durationInFrames={140}>
        <ArchitectureScene />
      </Sequence>

      {/* Scene 4: Rich Data Structures (20 - 28s / 400 - 560 frames) */}
      <Sequence from={400} durationInFrames={160}>
        <DataStructuresScene />
      </Sequence>

      {/* Scene 5: Use Cases (28 - 35s / 560 - 700 frames) */}
      <Sequence from={560} durationInFrames={140}>
        <UseCasesScene />
      </Sequence>
    </AbsoluteFill>
  );
};

const TitleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 25], [0.8, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity, transform: `scale(${scale})`, flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 30 }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: 30,
          backgroundColor: "#dc2626",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: 70,
          fontWeight: "bold",
          boxShadow: "0 20px 25px -5px rgba(220, 38, 38, 0.4)",
          marginRight: 30
        }}>
          R
        </div>
        <h1 style={{ fontSize: 110, fontWeight: 900, margin: 0, letterSpacing: "-2px" }}>
          REDIS
        </h1>
      </div>
      <p style={{ fontSize: 45, color: "#94a3b8", margin: 0, fontWeight: 500 }}>
        The In-Memory Data Store
      </p>
    </AbsoluteFill>
  );
};

const DefinitionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const slideUp = interpolate(frame, [0, 20], [50, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity, transform: `translateY(${slideUp}px)` }}>
      <div style={{ color: "#ef4444", fontSize: 40, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", marginBottom: 20 }}>
        01 / Definition
      </div>
      <h2 style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.2, margin: "0 0 40px 0" }}>
        Remote Dictionary Server
      </h2>
      <div style={{ display: "flex", gap: 40 }}>
        <div style={{ flex: 1, backgroundColor: "#1e293b", padding: 40, borderRadius: 24, borderLeft: "8px solid #ef4444" }}>
          <h3 style={{ fontSize: 45, margin: "0 0 20px 0", color: "#f8fafc" }}>⚡ Blazing Fast</h3>
          <p style={{ fontSize: 36, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
            Stores data in RAM, not on traditional slow magnetic or solid-state disks.
          </p>
        </div>
        <div style={{ flex: 1, backgroundColor: "#1e293b", padding: 40, borderRadius: 24, borderLeft: "8px solid #3b82f6" }}>
          <h3 style={{ fontSize: 45, margin: "0 0 20px 0", color: "#f8fafc" }}>🔑 Key-Value Store</h3>
          <p style={{ fontSize: 36, color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
            Simple yet powerful data structures accessible via unique string keys.
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ArchitectureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity }}>
      <div style={{ color: "#ef4444", fontSize: 40, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", marginBottom: 20 }}>
        02 / Architecture
      </div>
      <h2 style={{ fontSize: 80, fontWeight: 800, margin: "0 0 50px 0" }}>
        Single-Threaded Model
      </h2>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e293b", padding: 60, borderRadius: 30 }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>🌐</div>
          <div style={{ fontSize: 40, fontWeight: "bold" }}>Clients</div>
        </div>
        <div style={{ fontSize: 60, color: "#64748b" }}>➔</div>
        <div style={{ backgroundColor: "#dc2626", padding: "40px 60px", borderRadius: 20, textAlign: "center", boxShadow: "0 10px 25px rgba(220,38,38,0.3)" }}>
          <div style={{ fontSize: 45, fontWeight: "bold" }}>Event Loop</div>
          <div style={{ fontSize: 30, opacity: 0.9, marginTop: 10 }}>No Context Switching</div>
        </div>
        <div style={{ fontSize: 60, color: "#64748b" }}>➔</div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 60, marginBottom: 20 }}>🧠</div>
          <div style={{ fontSize: 40, fontWeight: "bold" }}>In-Memory RAM</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DataStructuresScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const structures = [
    { name: "Strings", desc: "Text or binary up to 512MB", color: "#ef4444" },
    { name: "Hashes", desc: "Maps of field-value pairs", color: "#f59e0b" },
    { name: "Lists", desc: "Linked lists of strings", color: "#10b981" },
    { name: "Sorted Sets", desc: "Unique elements ordered by score", color: "#3b82f6" },
  ];

  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity }}>
      <div style={{ color: "#ef4444", fontSize: 40, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", marginBottom: 20 }}>
        03 / Data Structures
      </div>
      <h2 style={{ fontSize: 80, fontWeight: 800, margin: "0 0 50px 0" }}>
        Beyond Simple Key-Value
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 30 }}>
        {structures.map((item, index) => {
          const delayItem = index * 8;
          const itemOpacity = interpolate(frame, [delayItem, delayItem + 15], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={item.name} style={{ backgroundColor: "#1e293b", padding: 40, borderRadius: 20, borderLeft: `8px solid ${item.color}`, opacity: itemOpacity }}>
              <div style={{ fontSize: 45, fontWeight: "bold", marginBottom: 10 }}>{item.name}</div>
              <div style={{ fontSize: 34, color: "#94a3b8" }}>{item.desc}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const UseCasesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const useCases = ["Caching & Database Acceleration", "Session Store", "Pub/Sub Messaging", "Leaderboards & Counters"];

  return (
    <AbsoluteFill style={{ padding: 120, justifyContent: "center", opacity }}>
      <div style={{ color: "#ef4444", fontSize: 40, fontWeight: 700, textTransform: "uppercase", letterSpacing: "3px", marginBottom: 20 }}>
        04 / Applications
      </div>
      <h2 style={{ fontSize: 80, fontWeight: 800, margin: "0 0 50px 0" }}>
        Common Use Cases
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {useCases.map((uc, index) => {
          const delayItem = index * 6;
          const itemOpacity = interpolate(frame, [delayItem, delayItem + 12], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div key={uc} style={{ display: "flex", alignItems: "center", backgroundColor: "#1e293b", padding: "30px 40px", borderRadius: 16, opacity: itemOpacity }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", backgroundColor: "#ef4444", marginRight: 30 }} />
              <div style={{ fontSize: 42, fontWeight: 600 }}>{uc}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};