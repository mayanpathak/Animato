# =========================================
# Base Image
# =========================================

FROM python:3.11-slim

# =========================================
# Install System Dependencies
# =========================================

RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    pkg-config \
    build-essential \
    texlive \
    texlive-latex-extra \
    texlive-fonts-extra \
    dvisvgm
# =========================================
# Install Manim
# =========================================

RUN pip install manim

# =========================================
# Set Working Directory
# =========================================

WORKDIR /workspace