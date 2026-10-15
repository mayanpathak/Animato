# docker/remotion-sandbox/Dockerfile
#
# Pinned, minimal image used to render untrusted, LLM-generated Remotion
# compositions. node_modules is baked in at BUILD time (never installed
# per-job) so that:
#   (a) no per-job network access to npm is needed (network is disabled
#       entirely at container runtime, see docker_exec.rs),
#   (b) dependency versions are fixed and auditable at image-build time,
#   (c) job start latency doesn't include an npm install.
#
# This image is rebuilt only when package.json/versions change, not per job.

FROM node:20-bookworm-slim AS base

# Remotion's headless Chromium needs these system libraries.
# This list matches Remotion's own documented Docker requirements.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# Non-root user. The render process never needs root inside the
# container; running as root inside a container that also has
# --cap-drop=ALL and --security-opt=no-new-privileges is still worse
# than not being root in the first place (defense in depth against
# any future container-runtime CVE that relies on UID 0).
# ------------------------------------------------------------------
RUN groupadd -r renderer && useradd -r -g renderer -m renderer

WORKDIR /app

# Only package.json is needed to install deps — copying it alone (before
# the rest of the app) means Docker's layer cache is reused across builds
# that don't change dependencies.
COPY package.json ./
COPY tsconfig.json ./

# Pre-fetch/verify the headless Chromium binary Remotion needs, at build
# time rather than at first-render time (avoids a network call inside the
# --network none render container later, and avoids unpredictable
# first-render latency).
RUN npm install --omit=dev && \
    npx remotion browser ensure

# The actual per-job source (src/index.ts, src/Root.tsx,
# src/compositions/GeneratedScene.tsx) is NOT copied into the image here
# — it gets bind-mounted read-only at container-run time (see
# docker_exec.rs). This keeps one image reusable for every job.

RUN chown -R renderer:renderer /app
USER renderer

ENTRYPOINT ["npx", "remotion"]
