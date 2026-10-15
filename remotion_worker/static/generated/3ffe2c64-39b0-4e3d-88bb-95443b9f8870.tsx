import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
} from "remotion";

export const DURATION_SECONDS = 30;

export const GeneratedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Background styling
  const bgStyle: React.CSSProperties = {
    backgroundColor: "#090d16",
    color: "#f8fafc",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    width: 1920,
    height: 1080,
    overflow: "hidden",
  };

  // Subtle animated grid pattern in background
  const gridShift = (frame * 1.5) % 80;

  return (
    <AbsoluteFill style={bgStyle}>
      {/* Background Tech Grid */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 1920,
          height: 1080,
          opacity: 0.15,
        }}
      >
        <defs>
          <pattern
            id="infra-grid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
            x={gridShift}
            y={gridShift}
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#infra-grid)" />
      </svg>

      {/* ============================================================ */}
      {/* SCENE 1: Title & The Full Infra Stack (0s - 7.5s, 150 frames) */}
      {/* ============================================================ */}
      <Sequence from={0} durationInFrames={150}>
        {(() => {
          const titleProgress = spring({
            frame,
            fps,
            config: { damping: 14, stiffness: 90 },
          });
          const fadeOut = interpolate(frame, [130, 150], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Staggered stack layers
          const layers = [
            { name: "3. Distributed Orchestration & Serving", tech: "Megatron-LM • vLLM • Ray", col: "#a855f7" },
            { name: "2. Ultra-Fast Interconnect Fabric", tech: "NVLink (1.8 TB/s) • InfiniBand Quantum-2", col: "#38bdf8" },
            { name: "1. Massive Accelerator Clusters", tech: "H100 / B200 SXM • HBM3e Memory", col: "#22c55e" },
          ];

          return (
            <AbsoluteFill
              style={{
                opacity: fadeOut,
                padding: "80px 120px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  transform: `translateY(${(1 - titleProgress) * 40}px)`,
                  opacity: titleProgress,
                  marginBottom: 60,
                }}
              >
                <div
                  style={{
                    fontSize: 92,
                    fontWeight: 900,
                    letterSpacing: "-2px",
                    background: "linear-gradient(90deg, #38bdf8, #a855f7)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  TRANSFORMER AI INFRA
                </div>
                <div
                  style={{
                    fontSize: 52,
                    fontWeight: 500,
                    color: "#94a3b8",
                    marginTop: 10,
                  }}
                >
                  The Supercomputing Stack Powering LLMs
                </div>
              </div>

              {/* Stack Layers */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  width: 1500,
                }}
              >
                {layers.map((layer, idx) => {
                  const itemSpring = spring({
                    frame: frame - 25 - idx * 15,
                    fps,
                    config: { damping: 14, stiffness: 100 },
                  });
                  return (
                    <div
                      key={idx}
                      style={{
                        transform: `scale(${0.9 + itemSpring * 0.1})`,
                        opacity: itemSpring,
                        backgroundColor: "#131b2e",
                        border: `5px solid ${layer.col}`,
                        borderRadius: 24,
                        padding: "26px 48px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: `0 12px 40px ${layer.col}33`,
                      }}
                    >
                      <span style={{ fontSize: 52, fontWeight: 700, color: "#f8fafc" }}>
                        {layer.name}
                      </span>
                      <span style={{ fontSize: 44, fontWeight: 600, color: layer.col }}>
                        {layer.tech}
                      </span>
                    </div>
                  );
                })}
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ============================================================ */}
      {/* SCENE 2: The GPU & Memory Wall (7.5s - 15s, 150 frames) */}
      {/* ============================================================ */}
      <Sequence from={150} durationInFrames={150}>
        {(() => {
          const localFrame = frame - 150;
          const sceneSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 14, stiffness: 90 },
          });
          const fadeOut = interpolate(localFrame, [130, 150], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          // Data flow pulses
          const pulseOffset = (localFrame * 12) % 300;

          return (
            <AbsoluteFill
              style={{
                opacity: Math.min(sceneSpring, fadeOut),
                padding: "70px 100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 50 }}>
                <div style={{ fontSize: 88, fontWeight: 900, color: "#38bdf8" }}>
                  THE MEMORY WALL & COMPUTE
                </div>
                <div style={{ fontSize: 50, color: "#94a3b8", marginTop: 8 }}>
                  High Bandwidth Memory (HBM3e) vs. Tensor Cores
                </div>
              </div>

              {/* Diagram Stage */}
              <div
                style={{
                  display: "flex",
                  width: 1700,
                  height: 620,
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#0d1424",
                  borderRadius: 30,
                  border: "5px solid #1e293b",
                  padding: "40px 60px",
                  position: "relative",
                }}
              >
                {/* HBM Box */}
                <div
                  style={{
                    width: 480,
                    height: 500,
                    backgroundColor: "#1e1b4b",
                    border: "6px solid #818cf8",
                    borderRadius: 24,
                    padding: 36,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 56, fontWeight: 900, color: "#a5b4fc" }}>
                      HBM3e STACK
                    </div>
                    <div style={{ fontSize: 44, color: "#cbd5e1", marginTop: 12 }}>
                      Capacity: 141 GB+
                    </div>
                    <div style={{ fontSize: 44, color: "#38bdf8", fontWeight: 700 }}>
                      BW: 4.8 TB/second
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#312e81",
                      padding: 20,
                      borderRadius: 16,
                      fontSize: 42,
                      color: "#e0e7ff",
                      fontWeight: 600,
                    }}
                  >
                    Holds Weights &amp; Dynamic KV Cache
                  </div>
                </div>

                {/* Animated Transfer Bus */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  <svg width="500" height="120" viewBox="0 0 500 120">
                    <line
                      x1="20"
                      y1="60"
                      x2="480"
                      y2="60"
                      stroke="#475569"
                      strokeWidth="10"
                      strokeDasharray="16 16"
                    />
                    <line
                      x1="20"
                      y1="60"
                      x2="480"
                      y2="60"
                      stroke="#38bdf8"
                      strokeWidth="8"
                      strokeDasharray="40 160"
                      strokeDashoffset={-pulseOffset}
                    />
                    <polygon points="460,40 495,60 460,80" fill="#38bdf8" />
                  </svg>
                  <div
                    style={{
                      fontSize: 44,
                      fontWeight: 700,
                      color: "#f59e0b",
                      backgroundColor: "#451a03",
                      padding: "10px 24px",
                      borderRadius: 14,
                      border: "4px solid #f59e0b",
                    }}
                  >
                    Memory Bottleneck
                  </div>
                </div>

                {/* Tensor Cores / Compute Box */}
                <div
                  style={{
                    width: 520,
                    height: 500,
                    backgroundColor: "#064e3b",
                    border: "6px solid #34d399",
                    borderRadius: 24,
                    padding: 36,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 56, fontWeight: 900, color: "#6ee7b7" }}>
                      TENSOR CORES
                    </div>
                    <div style={{ fontSize: 44, color: "#cbd5e1", marginTop: 12 }}>
                      Compute: 4 PFLOPS
                    </div>
                    <div style={{ fontSize: 44, color: "#34d399", fontWeight: 700 }}>
                      FP8 / FP16 GEMM
                    </div>
                  </div>
                  <div
                    style={{
                      backgroundColor: "#065f46",
                      padding: 20,
                      borderRadius: 16,
                      fontSize: 42,
                      color: "#d1fae5",
                      fontWeight: 600,
                    }}
                  >
                    Executes Attention &amp; MLP Projections
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ============================================================ */}
      {/* SCENE 3: Scale-Up vs Scale-Out Fabric (15s - 22.5s, 150 frames) */}
      {/* ============================================================ */}
      <Sequence from={300} durationInFrames={150}>
        {(() => {
          const localFrame = frame - 300;
          const sceneSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 14, stiffness: 90 },
          });
          const fadeOut = interpolate(localFrame, [130, 150], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <AbsoluteFill
              style={{
                opacity: Math.min(sceneSpring, fadeOut),
                padding: "70px 100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 50 }}>
                <div style={{ fontSize: 88, fontWeight: 900, color: "#a855f7" }}>
                  NETWORK INTERCONNECT FABRIC
                </div>
                <div style={{ fontSize: 50, color: "#94a3b8", marginTop: 8 }}>
                  Scale-Up (Intra-Node) vs. Scale-Out (Cluster-Wide)
                </div>
              </div>

              {/* Two Comparison Columns */}
              <div
                style={{
                  display: "flex",
                  width: 1720,
                  gap: 60,
                  justifyContent: "center",
                }}
              >
                {/* Scale Up Column */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#111827",
                    border: "6px solid #0284c7",
                    borderRadius: 28,
                    padding: 48,
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                  }}
                >
                  <div style={{ fontSize: 58, fontWeight: 900, color: "#38bdf8" }}>
                    SCALE-UP (Inside 8-GPU Node)
                  </div>
                  <div
                    style={{
                      fontSize: 50,
                      fontWeight: 700,
                      color: "#f8fafc",
                      backgroundColor: "#0369a1",
                      padding: "12px 24px",
                      borderRadius: 16,
                      alignSelf: "flex-start",
                    }}
                  >
                    NVLink: 900 GB/s to 1.8 TB/s
                  </div>
                  <div style={{ fontSize: 46, color: "#cbd5e1", lineHeight: 1.4 }}>
                    • NVSwitch crossbar connects all 8 GPUs
                    <br />
                    • Shared cache-coherent address space
                    <br />
                    • Ideal for Tensor Parallelism (TP)
                  </div>
                </div>

                {/* Scale Out Column */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#111827",
                    border: "6px solid #9333ea",
                    borderRadius: 28,
                    padding: 48,
                    display: "flex",
                    flexDirection: "column",
                    gap: 28,
                  }}
                >
                  <div style={{ fontSize: 58, fontWeight: 900, color: "#c084fc" }}>
                    SCALE-OUT (Across 10k+ Racks)
                  </div>
                  <div
                    style={{
                      fontSize: 50,
                      fontWeight: 700,
                      color: "#f8fafc",
                      backgroundColor: "#7e22ce",
                      padding: "12px 24px",
                      borderRadius: 16,
                      alignSelf: "flex-start",
                    }}
                  >
                    InfiniBand / RoCE: 800 Gb/s
                  </div>
                  <div style={{ fontSize: 46, color: "#cbd5e1", lineHeight: 1.4 }}>
                    • Non-blocking Fat-Tree network topology
                    <br />
                    • RDMA offload avoids CPU bottlenecks
                    <br />
                    • Drives Pipeline (PP) &amp; Data Parallel (DP)
                  </div>
                </div>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>

      {/* ============================================================ */}
      {/* SCENE 4: 3D Parallelism & Supercomputing Summary (22.5s - 30s) */}
      {/* ============================================================ */}
      <Sequence from={450} durationInFrames={150}>
        {(() => {
          const localFrame = frame - 450;
          const sceneSpring = spring({
            frame: localFrame,
            fps,
            config: { damping: 14, stiffness: 90 },
          });

          const pillars = [
            {
              title: "TENSOR PARALLEL (TP)",
              desc: "Splits linear matrices within a single server across fast NVLink.",
              tag: "Intra-Node",
              color: "#38bdf8",
            },
            {
              title: "PIPELINE PARALLEL (PP)",
              desc: "Distributes transformer layers sequentially across separate nodes.",
              tag: "Inter-Node",
              color: "#ec4899",
            },
            {
              title: "FSDP / DATA (DP)",
              desc: "Shards model weights, gradients & optimizer states across the cluster.",
              tag: "Cluster-Wide",
              color: "#10b981",
            },
          ];

          return (
            <AbsoluteFill
              style={{
                opacity: sceneSpring,
                padding: "60px 100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <div style={{ fontSize: 88, fontWeight: 900, color: "#22c55e" }}>
                  3D PARALLELISM FRAMEWORK
                </div>
                <div style={{ fontSize: 48, color: "#94a3b8", marginTop: 6 }}>
                  Splitting Billion &amp; Trillion-Parameter Transformers
                </div>
              </div>

              {/* 3 Pillars Grid */}
              <div
                style={{
                  display: "flex",
                  width: 1720,
                  gap: 36,
                  marginBottom: 40,
                }}
              >
                {pillars.map((p, idx) => {
                  const cardSpring = spring({
                    frame: localFrame - idx * 10,
                    fps,
                    config: { damping: 14, stiffness: 100 },
                  });

                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        backgroundColor: "#131b2e",
                        border: `5px solid ${p.color}`,
                        borderRadius: 24,
                        padding: 36,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transform: `scale(${cardSpring})`,
                        boxShadow: `0 8px 30px ${p.color}22`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 38,
                            fontWeight: 800,
                            color: p.color,
                            textTransform: "uppercase",
                            marginBottom: 12,
                          }}
                        >
                          {p.tag}
                        </div>
                        <div
                          style={{
                            fontSize: 52,
                            fontWeight: 900,
                            color: "#f8fafc",
                            lineHeight: 1.15,
                            marginBottom: 20,
                          }}
                        >
                          {p.title}
                        </div>
                        <div
                          style={{
                            fontSize: 44,
                            color: "#cbd5e1",
                            lineHeight: 1.35,
                          }}
                        >
                          {p.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Final Summary Ribbon */}
              <div
                style={{
                  width: 1720,
                  backgroundColor: "#1e293b",
                  border: "5px solid #64748b",
                  borderRadius: 20,
                  padding: "24px 40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 50,
                    fontWeight: 800,
                    color: "#f8fafc",
                    textAlign: "center",
                  }}
                >
                  🚀 AI Infra turns 10,000+ independent GPUs into one cohesive giant brain.
                </span>
              </div>
            </AbsoluteFill>
          );
        })()}
      </Sequence>
    </AbsoluteFill>
  );
};