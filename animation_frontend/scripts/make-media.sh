#!/usr/bin/env bash
# Generates the real media files the app and tests use (needs ffmpeg with
# libvpx-vp9, libopus and libfreetype). Output is committed, so this only
# needs to run when the media changes.
#
#   e2e/fixtures/        test inputs for the editor e2e suite
#   public/media/renders sample "rendered animations" the MSW job mock serves
#                        from GET /api/jobs/:id/video (VP9/Opus WebM: plays in
#                        every Chromium build, including headless)
#   public/fonts         OTF fonts the WebGPU compositor (glyphon) loads
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIX="$ROOT/e2e/fixtures"
REN="$ROOT/public/media/renders"
FONTS="$ROOT/public/fonts"
INTER=/usr/share/fonts/opentype/inter
mkdir -p "$FIX/sequence" "$REN" "$FONTS"

FF=(ffmpeg -hide_banner -loglevel error -y)
VP9=(-c:v libvpx-vp9 -crf 36 -deadline good -cpu-used 4 -row-mt 1 -pix_fmt yuv420p)
OPUS=(-c:a libopus -b:a 96k)

# --- Test fixtures -----------------------------------------------------------
# 5 s moving test pattern + 440 Hz tone, 640x360 @ 30 fps.
"${FF[@]}" -f lavfi -i "testsrc2=size=640x360:rate=30:duration=5" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=5" \
  -ac 2 "${VP9[@]}" -g 30 "${OPUS[@]}" -shortest "$FIX/clip.webm"
# Same clip in MP4 (VP9 + Opus), demuxed by the Rust offcut-mp4 crate.
"${FF[@]}" -i "$FIX/clip.webm" -c copy -movflags +faststart -strict experimental "$FIX/clip.mp4"
# 4 s stereo tone for audio import.
"${FF[@]}" -f lavfi -i "sine=frequency=330:sample_rate=48000:duration=4" -ac 2 "$FIX/tone.wav"
# A still image and a 3 s PNG sequence (10 fps).
"${FF[@]}" -f lavfi -i "gradients=size=1280x720:c0=0x7c3aed:c1=0x22d3ee:c2=0xe879f9:duration=1" -frames:v 1 "$FIX/image.png"
"${FF[@]}" -f lavfi -i "cellauto=size=320x180:rate=10:rule=110" -t 3 "$FIX/sequence/frame_%03d.png"

# --- Sample renders for the job mock ----------------------------------------
title() { # text, y, size
  echo "drawtext=fontfile=$INTER/Inter-SemiBold.otf:text='$1':fontcolor=white:fontsize=$3:x=(w-text_w)/2:y=$2:alpha='min(1,t/0.6)'"
}
sub() {
  echo "drawtext=fontfile=$INTER/Inter-Regular.otf:text='$1':fontcolor=0xc4c4d4:fontsize=$3:x=(w-text_w)/2:y=$2:alpha='min(1,max(0,(t-0.5)/0.6))'"
}
render() { # name, video filtergraph, duration, tone frequency
  "${FF[@]}" -f lavfi -i "$2" \
    -f lavfi -i "sine=frequency=$4:sample_rate=48000:duration=$3,volume=0.12,afade=t=in:d=0.5,afade=t=out:st=$(($3 - 1)):d=1" \
    -t "$3" -ac 2 "${VP9[@]}" -b:v 650k -maxrate 800k -bufsize 1600k -g 60 "${OPUS[@]}" -shortest "$REN/$1.webm"
}

render manim-mandelbrot \
  "mandelbrot=size=1280x720:rate=30:start_scale=3:end_scale=0.4:end_pts=180,hue=s=1.3,$(title 'Zooming into the Mandelbrot set' 560 44),$(sub 'z → z² + c' 620 30)" \
  6 220
render manim-automaton \
  "cellauto=size=1280x720:rate=30:rule=30:scroll=1,negate,colorchannelmixer=rr=0.55:gg=0.36:bb=0.96,$(title 'Rule 30, one row at a time' 620 44)" \
  6 262
render remotion-gradient \
  "gradients=size=1280x720:rate=30:c0=0x4c1d95:c1=0x0e7490:c2=0x86198f:c3=0x07070a:speed=0.012:duration=6,$(title 'Ship faster with Animato' 300 72),$(sub 'Q3 product update' 390 34)" \
  6 330
render remotion-life \
  "life=size=320x180:rate=30:mold=10:ratio=0.2:death_color=0x1b1b24:life_color=0x22d3ee,scale=1280:720:flags=neighbor,$(title 'Growth, visualised' 300 64)" \
  6 294

# --- Fonts for the compositor ---------------------------------------------
cp "$INTER/Inter-Regular.otf" "$INTER/Inter-Bold.otf" "$FONTS/"
cp /usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf "$FONTS/" 2>/dev/null || true

du -sh "$FIX" "$REN" "$FONTS"
