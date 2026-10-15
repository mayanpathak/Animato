# Offcut — Private, Browser-Native Video Editing

> **Positioning line (MVP):** "Offcut — the private video editor that processes 1080p video entirely in your browser. Drop it, cut the dead air, caption it, export it — nothing ever leaves your machine." (4K is a post-MVP capability, not a launch promise — see Section 0.)

---

## 0. What Changed From Your Original Idea (Read This First)

Your instinct — "backend shrinks to auth + billing + rate limiting, WASM does the heavy lifting, margins get insane" — is directionally right and is the actual product thesis. But three parts of the raw idea need correction before this is buildable and sellable:

1. **Pure Rust-WASM ffmpeg for video is too slow to be the core pitch.** WASM has no direct hardware (GPU) encode/decode access, and software-encoding in-browser is CPU-bound and slow, especially on laptops. The fix: use the browser's native **WebCodecs API** (hardware-accelerated decode/encode, supported in Chrome/Edge, and shipping in Safari) for the encode/decode path, and use **Rust→WASM only for the logic that WebCodecs doesn't do**: silence/scene detection, waveform analysis, frame diffing, filters, subtitle rendering, muxing/demuxing (via a WASM-compiled `mp4box`/`matroska` muxer). This is a hybrid architecture, not pure WASM — and it's what makes "fast" actually true. This document specs the hybrid.
2. **The feature list is a roadmap, not an MVP.** Eleven capabilities (transcode, compress, extract audio, normalize, cut, thumbnails, scene detection, format conversion, subtitle burn-in, silence removal, frame extraction) is a v2.0 product. Section 9 cuts this to a narrow MVP built around one linear workflow, because a wide MVP is the single most common reason self-funded SaaS products miss 3,000 users in 6 months.
3. **"Videos never leave your machine" is in tension with auto-captions**, which is the single highest-demand feature in this category. Pure on-device speech-to-text (WASM Whisper-tiny/base) is possible but materially worse quality than cloud STT, and large model downloads hurt first-run experience. Section 12 specs this as an explicit, disclosed choice the user makes — not a silent compromise — because the privacy claim is the whole brand and it cannot be fudged.
4. **4K is cut from the MVP entirely — this is a deliberate, load-bearing scope decision, not a minor tweak.** A 3840×2160 frame carries ~4× the pixels of 1080p (2.07M vs 8.29M pixels), and that ratio compounds across decoded-frame buffers, encoder buffers, compositor buffers, and WASM linear memory. 4K is the single biggest driver of browser crashes, low-end-laptop failure, and testing-matrix size. Cutting it does **not** remove the hardest engineering problems (see point 5) — it removes the performance/memory/compatibility ceiling stacked on top of them. The MVP promise becomes "fast 1080p," not "fast 4K"; 4K becomes a clearly-labeled P1/P2 capability added once the 1080p pipeline is proven on real footage (Section 9, Section 26).
5. **The MVP is a single linear pipeline, not a general-purpose editor**, and input is deliberately restricted rather than "any video file." Constraining container/codec/resolution/duration up front (Section 9) is arguably a bigger scope reduction than dropping 4K, because it bounds the testing matrix (MP4/H.264/AAC only, not MOV/WebM/MKV/HEVC/AV1/VFR) rather than just the pixel count. This does not make the remaining work easy — producing a new valid media stream after cutting silence still requires correct video/audio timestamps, keyframes, frame ordering, duration, A/V sync, and MP4 sample-table rewriting. That is real video-engineering work regardless of resolution, and the document does not pretend otherwise.

The rest of this document treats your core thesis as correct and builds the sharpest, most tractable version of it.

---

## 1. Executive Summary

Offcut is a browser-based video editing tool for solo content creators (YouTubers, podcasters-with-video, course creators, short-form clippers) that processes video **entirely on the user's device** using Rust compiled to WebAssembly plus the browser's native WebCodecs hardware encoder. The MVP is deliberately narrow — a single linear pipeline (drop video → remove silence → adjust cuts → caption → choose output size → export) restricted to MP4/H.264/AAC at up to 1080p — not a general-purpose editor. The backend is deliberately thin — authentication, billing, usage metering, and project/preset sync — which gives the business software-margin economics without the GPU/storage/bandwidth bill that every competitor (Descript, Kapwing, CapCut Web, Veed) carries. The wedge is trust + speed: creators handling unreleased episodes, client footage, or sensitive recordings get a tool that is both faster (no upload wait) and structurally private (video literally never hits a server). Target: 3,000 paying subscribers at $12–$18/mo within 6 months of public launch (~$40–50K MRR).

---

## 2. Problem

Creators editing raw footage into publishable video currently choose between:
- **Cloud editors (Descript, Kapwing, Veed, CapCut Web):** convenient, but every file uploads first (slow on 4K/long recordings), footage sits on a third-party server, and the vendor's compute costs get passed on as either steep pricing or aggressive export watermarking/limits.
- **Native desktop apps (Premiere, DaVinci, Final Cut):** powerful but heavy, expensive, steep learning curve, install/update friction, not usable from a Chromebook or work laptop without admin rights.
- **Nothing / manual work:** many light editing tasks (cut dead air, compress for upload, burn a caption track) get skipped entirely because the tooling overhead isn't worth it for a 6-minute clip.

The specific, underserved pain: **fast, no-install, no-upload cleanup of routine footage** — the 80% of editing work (trim, compress, caption, silence removal) that doesn't need a timeline-based NLE.

## 3. Target Customer

**Primary ICP:** Solo or small-team content creators who record more video than they can efficiently edit — YouTubers (5K–200K subs), podcasters who now also publish video, indie course creators, and social clippers repurposing long-form into shorts. They are price-sensitive ($10–20/mo is a real ceiling), technically comfortable, and currently either pay for Descript/CapCut or cobble together free tools.

**Secondary ICP (higher willingness to pay, smaller volume, worth targeting in months 4–6):** People bound by confidentiality — therapists/coaches recording sessions, lawyers doing video depositions, internal L&D/HR teams producing training video, journalists handling unreleased footage. For these, "never uploaded" is a compliance answer, not a nice-to-have, and $30–50/mo team pricing is plausible later. MVP pricing still targets the primary ICP; Section 17 revisits this segment for expansion.

## 4. Persona (primary)

**"Maya," 27, solo YouTuber/podcaster, 40K subscribers.** Records 45–90 minute conversations on Riverside/Zoom, needs to cut dead air, compress to under platform limits, add burned-in captions for social clips, and get a clean export fast — she edits between a day job and uploads on a fixed weekly schedule, so turnaround speed matters as much as feature depth. She currently pays for Descript and is annoyed by upload times on a slow home connection and by watermark/export limits on the plan below hers.

## 5. Jobs To Be Done

1. "When I finish recording, let me quickly cut the boring parts without opening a timeline editor."
2. "When I need to post on Twitter/LinkedIn, let me compress a 2GB file to under their limit without losing quality I can see."
3. "When I clip a short from a long episode, let me burn in captions so it's watchable muted."
4. "When I hand a client draft footage, let me be sure it never sat on someone else's server."

## 6. Value Proposition

**For creators who edit more footage than they have patience for**, Offcut is a browser tool that trims, compresses, and captions video **without ever uploading it**, so exports start in seconds instead of after a multi-minute upload — and sensitive footage never leaves the machine it was recorded on.

## 7. Differentiation & Alternatives

| Alternative | What it solves | Weakness Offcut exploits |
|---|---|---|
| Descript | Transcript-based editing, good captions | Upload required; per-minute transcription costs baked into pricing; heavier tool than most quick-edit needs |
| CapCut Web / Veed | Free tier, social-native | Upload required; aggressive upsells/watermarks; privacy story is weak (ad-supported company) |
| Premiere/DaVinci | Full power | Install, learning curve, overkill for routine cleanup, not usable on locked-down/work devices |
| Doing it manually / skipping the step | Zero cost | Unpublished quality bar, wasted time |

*Note: competitor pricing/feature claims above are general-market knowledge as of the assistant's training and should be re-verified against current pricing pages before launch messaging is finalized — flagged as a research requirement, not a verified fact.*

## 8. Product Principles

1. **Nothing uploads by default.** Any feature that requires leaving the device (e.g., optional cloud transcription) is opt-in, clearly labeled, and never silently triggered.
2. **Time-to-first-export beats feature count.** Every MVP decision optimizes for a new user exporting something in under 5 minutes.
3. **Large files must not crash the tab.** Chunked/streamed processing is a correctness requirement, not an optimization.
4. **Free tier must produce a genuinely usable export**, or trial users never reach the aha moment.

---

## 9. MVP Scope (P0) — Ruthless Cut

**MVP is not "a video editor with fewer features." It is one single-purpose, linear pipeline**, with no branching editor UI beyond adjusting what the pipeline already proposes:

```
DROP VIDEO → ANALYZE → REMOVE SILENCE → EDIT CUTS → GENERATE CAPTIONS → CHOOSE OUTPUT SIZE → EXPORT
```

Explicitly **not** in the MVP, regardless of how commonly-requested: multi-track timeline, transitions, effects, arbitrary frame manipulation, scene detection, project collaboration, cloud video storage, arbitrary codecs/containers, or a general media library. These aren't deferred reluctantly — a general-purpose editor is a different, much larger product, and Offcut's MVP wedge only needs the pipeline above.

### Hard input/output constraints (this is a scope decision, not a technical footnote)

Restricting format is arguably a bigger complexity cut than restricting resolution, because it bounds the *testing matrix*, not just frame size:

| | MVP | Explicitly deferred |
|---|---|---|
| **Input container** | MP4 only | MOV, WebM, MKV |
| **Input video codec** | H.264 only | HEVC, AV1, VP9 |
| **Input audio codec** | AAC only | — |
| **Resolution** | ≤ 1920×1080 | 4K/8K (see below) |
| **Frame rate** | ≤ 60 FPS | Variable frame rate (VFR) |
| **File size** | ≤ 2 GB | Larger, chunked-streaming only |
| **Output** | MP4 / H.264 / AAC, 720p or 1080p | 4K export, alternate containers |

Any file outside these bounds gets a clear, specific rejection message at drop-time (not a silent failure or a crash) — e.g., "This is HEVC — Offcut currently supports H.264 MP4. Re-export from your recorder as H.264 and try again."

### Why 4K is cut, specifically

A 3840×2160 frame is ~4× the pixel count of 1080p (8.29M vs. 2.07M pixels), and that multiplies across every decoded-frame buffer, encoder buffer, and WASM memory allocation in the pipeline — it is the largest single driver of tab crashes, low-end-hardware failure, and QA surface area. Dropping it does not remove the hard problems below; it removes the ceiling on top of them. 4K support is a post-MVP milestone (Section 26), added once the 1080p pipeline is validated on real (not demo) footage.

### What restricting format/resolution does *not* remove

Cutting a silence segment out of a video is not "delete those bytes." Producing a valid resulting file requires the pipeline to correctly rebuild: video timestamps, audio timestamps, keyframe placement, frame ordering, overall duration, audio/video sync, and MP4 sample tables. This is genuine media-engineering work at any resolution — the 1080p-only, MP4-only constraint bounds the *scope* of that work, it doesn't eliminate it. Section 15 and Section 26 both treat this as the core engineering risk, not a solved problem.

| Feature | Priority | Why |
|---|---|---|
| Drag-in video, local decode via WebCodecs, scrub/preview | P0 | Table stakes |
| Format/resolution/size validation at drop-time with clear rejection messaging | P0 | Prevents silent failures and crash reports from out-of-scope files |
| Automatic silence/dead-air detection + cut list (Rust/WASM waveform analysis) | P0 | Highest-leverage single feature; this is the "aha moment" |
| Edit cuts — accept/reject/adjust individual auto-detected cuts (no general timeline) | P0 | Needed to correct auto-cuts; deliberately not a multi-track editor |
| Correct MP4 remux after cuts (timestamps, keyframes, sample tables, A/V sync) | P0 | The actual hard problem — see above; must be correct, not just fast |
| Compress/transcode to presets (YouTube, Twitter/X, LinkedIn, "smallest file"), 720p/1080p output via WebCodecs hardware encode | P0 | Second most-requested use case, cleanly demoable |
| Burned-in captions from **on-device** Whisper-tiny/base (WASM) — opt-in cloud STT for higher accuracy | P0 (on-device), P1 (cloud opt-in) | Core promise feature; see Section 12 for the privacy trade-off design |
| Export to MP4 (H.264 baseline), local download, no upload | P0 | The entire point |
| Auth (email + Google), billing (Stripe), usage counter (exported minutes/month) | P0 | Business requires it |
| Saved presets, local project autosave (IndexedDB) | P1 | Retention driver, not launch-blocking |
| 4K input/output support | P1 | Deferred deliberately — see above; revisit once 1080p pipeline is proven |
| Scene-change detection, thumbnail generation, frame extraction, additional containers/codecs (MOV, HEVC, VFR), audio normalization loudness targets | P2 | Real features, not needed to prove the core loop |
| Team sharing, multi-track timeline, effects/transitions | P2 | Explicitly out of scope until PMF is proven |

**MVP definition of done:** a new user can drop in a 20-minute 1080p MP4/H.264/AAC recording, get an automatic silence-cut suggestion, adjust it, add burned-in captions, export a compressed 720p or 1080p MP4 under a chosen size target with correct A/V sync throughout, and download it — entirely client-side except for auth/billing calls — in under 10 minutes end to end, on a mid-range 2021+ laptop, without the tab crashing on files up to 2GB.

### Engineering scope estimate

| Version | LOC (rough) |
|---|---|
| Proof of concept | 3–5K |
| Functional MVP (this section) | 20–30K |
| Production-hardened MVP | 25–40K |
| Mature product (adds 4K, more codecs, richer editor) | 50–80K |
| Full editor competing with desktop/cloud tools | 100K+ |

Budget around **~30K LOC for the production MVP**. This is a reasonable target for a disciplined, AI-assisted solo build, but treat it as a planning number, not a ceiling — browser/media edge cases reliably surface work that wasn't visible up front.

---

## 10. Core User Journey (first 10 minutes)

1. **Landing page** states the pitch in one line + a live in-browser demo widget (drop any short sample clip, see silence-cut run client-side, no signup) — this is the single highest-leverage conversion element, because it *proves* the privacy/speed claim instead of asserting it.
2. **Signup** (email or Google) — no credit card required for free tier.
3. **First project**: user drops a file. A progress bar shows local decode (not "uploading…" — copy must say "processing on your device" to reinforce the differentiator).
4. **Auto-cut suggestion** appears as a waveform with dead-air segments pre-highlighted. This is the **activation event**: user accepts or edits at least one auto-suggested cut.
5. User adds captions (on-device, default) and picks a compression preset.
6. **Export** — file renders locally and downloads. This is the **aha moment**: "that was fast, and I never watched a progress bar for an upload."
7. Free tier caps exported minutes/month (Section 15); hitting the cap on a real project is the upgrade trigger, shown inline, not via a surprise paywall mid-export.

---

## 11. Monetization

Because COGS is unusually low (no server-side transcode/GPU cost — the user's device pays for compute), pricing can be aggressive relative to competitors while retaining strong margin. Pricing is value-based on **exported minutes/month** and **caption accuracy tier**, not seats.

| Plan | Price | Included | Target |
|---|---|---|---|
| Free | $0 | 30 exported min/mo, on-device captions only, 1080p cap, watermark-free (no watermark — this is a differentiator vs. free competitors) | Trial → activation |
| Creator | $12/mo ($9/mo annual) | 300 exported min/mo, on-device captions, 1080p export, saved presets | Primary paid tier |
| Pro | $19/mo ($15/mo annual) | Unlimited exported minutes, opt-in cloud captions (higher accuracy), priority WASM model updates, project cloud-backup (encrypted, optional); early access to 4K export once shipped post-MVP (Section 26) | Power users, target ~30% of paid base |

**Why customers pay:** time saved per edit (no upload wait) is felt every single session, unlike features that are used once. **Why free stays generous:** the free tier must be good enough that a real export happens, because the aha moment (a finished download) is what converts, not a paywall.

**Upgrade trigger:** minute-cap reached mid-project, shown as "you've used 28/30 minutes this month — this export needs 6" with an inline upgrade button, never a blocked export with no explanation.

---

## 12. On-Device vs. Cloud Captions — The Trust-Critical Feature

This is specced separately because it is the one place the core privacy claim and the highest-demand feature genuinely conflict, and it must be handled honestly:

- **Default: on-device captions**, WASM-compiled Whisper-tiny or base model (~40–150MB, cached after first download via IndexedDB/Cache API). Lower accuracy than cloud, especially on accented speech or cross-talk, but the video and audio never leave the device.
- **Opt-in: cloud captions (Pro tier)**, explicitly labeled "Audio only is sent to our transcription provider for this feature — your video is never uploaded." Toggle defaults OFF. This preserves the "video never leaves your machine" claim as literally true even when cloud captions are used, since only the extracted audio track (not the video) is sent.
- Settings page must show, in plain language, exactly what data (if any) has ever left the device for that account — this becomes a trust/marketing asset, not just a settings page.

---

## 13. 3,000-Paying-Customer Plan (Explicit Assumptions)

Target: 3,000 paying subscribers, blended ~$14/mo average (mix of Creator/Pro, monthly/annual) ≈ **$42K MRR** by end of month 6.

**Funnel assumptions (labeled as assumptions, not guarantees):**

| Stage | Assumption | Volume needed |
|---|---|---|
| Visitors (6-mo cumulative) | 2.5% visitor→signup | ~200,000 visitors |
| Signups | 35% reach activation event (accept ≥1 auto-cut) | ~70,000 signups |
| Activated → free-to-paid conversion | 4.5% (SaaS free-tier norm is 2–5%) | ~3,150 paying |
| Monthly churn | ~5%/mo, offset by continued signups | Net growth assumed positive through month 6 |

These numbers require **200K visitors over 6 months (~33K/mo average, back-loaded)** — the hardest number in this table and the one to pressure-test first. It is not guaranteed; if content/SEO velocity or the interactive demo's virality underperforms, 3,000 is not reached on this timeline without paid acquisition spend, which the low-COGS margin structure can partially absorb.

### Month-by-month

- **Month 1 — Build:** MVP per Section 9. No marketing yet beyond a waitlist landing page with the live client-side demo widget.
- **Month 2 — Private beta:** 100–200 creators from YouTube/podcast communities (Reddit r/NewTubers, Discord editing servers, cold DMs to mid-tier creators offering free Pro access for feedback). Goal: validate the activation event actually fires for real footage, not just demo clips.
- **Month 3 — Public launch:** Product Hunt, Hacker News ("I built a video editor with zero upload — here's the WASM/WebCodecs architecture" is a genuinely strong HN post for this audience), and a technical blog post explaining the WebCodecs+WASM hybrid — this audience (developers, privacy-conscious creators) is likely to amplify a real engineering story.
- **Month 4 — Growth optimization:** Programmatic SEO around "compress video for [platform]" and "remove silence from podcast" long-tail pages (each doubling as a free, no-signup-required tool that showcases the in-browser engine — strong PLG loop, since the tool itself is the marketing asset).
- **Month 5 — Scale acquisition:** Creator partnerships/affiliate program (creators who already talk about their editing workflow), YouTube sponsorship spots in the editing-software niche.
- **Month 6 — Approach 3,000:** Referral incentive (extra exported minutes for both sides) kicks in once there's a real paid base to refer from.

**If this undershoots:** the most likely cause is the free-tool/programmatic-SEO pages underperforming as a channel, since that's the primary organic engine. Mitigation is to shift budget toward the affiliate/creator-partnership channel earlier, which is slower to start but more predictable once seeded.

---

## 14. Retention & Churn

**Why users come back:** the product is used per-recording-session, which for an active podcaster/YouTuber is weekly — a natural habit loop, not something they have to remember to use. Saved presets and project autosave reduce switching cost over time (their compression/caption settings live in Offcut). Likely churn causes: (a) creator stops publishing regularly (unavoidable, cohort-level), (b) on-device caption accuracy frustrates a user who never opts into cloud captions — mitigated by clear in-product prompting to try the cloud option before they churn, (c) large-file performance issues on older hardware — mitigated by the chunked-processing requirement in Section 9's definition of done.

---

## 15. Technical Architecture

**Pipeline architecture (MVP):**

```
                         Browser
                            │
                 ┌──────────┴──────────┐
                 │                     │
            TypeScript              Rust/WASM
             (UI, EDL)          ┌───────┴───────┐
                 │              │               │
                 │          Analysis         Captions
                 │        (silence, cuts)   (Whisper on-device)
                 │              │
                 └───────┬──────┘
                          │
                Edit Decision List (EDL)
                          │
                          ▼
                     WebCodecs
                ┌─────────┴─────────┐
                │                   │
             Decoder             Encoder
                │                   │
                └─────────┬─────────┘
                          │
                     MP4 remux
              (timestamps, keyframes,
               sample tables, A/V sync)
                          │
                          ▼
                  Local download

Server touches:  Auth · Billing · Usage metering  —  never video/audio
```

**Frontend (Vercel):** React + TypeScript. Rust compiled to WASM (via `wasm-pack`) for: silence/waveform detection, subtitle rendering/burn-in compositing, and MP4 remuxing/sample-table rebuilding after cuts (the genuine media-engineering work noted in Section 9 — this doesn't go away with the resolution cut). **WebCodecs API** for hardware-accelerated decode/encode, constrained to the MVP's H.264/AAC/≤1080p input envelope (falls back to a slower WASM software encode path on unsupported browsers, with a clear "reduced performance" notice — Safari/Firefox WebCodecs support should be re-verified at build time as it evolves). Large files processed in chunks via the File System Access API where available (Chromium) with a Blob-streaming fallback elsewhere, to avoid loading entire files into memory — the 1080p/2GB ceiling makes this considerably more tractable than it would be at 4K, but chunking is still required, not optional. Scene-change detection, arbitrary frame diffing, and additional containers/codecs are explicitly out of the MVP WASM module (Section 9, P2).

**Backend (Render):** Thin API — auth (email + OAuth), Stripe billing/webhooks, usage-minute metering, preset/project-metadata sync (not video data), rate limiting on API endpoints. Optional cloud-captions endpoint proxies audio-only to a third-party STT provider and returns text — never touches video.

**Data stored server-side:** account info, subscription state, usage counters, preset JSON, project *metadata* (filenames, cut-list timestamps) — never raw video/audio, except the transient audio buffer for opt-in cloud captions, which is not retained post-transcription (documented retention policy required — legal review needed).

**MVP vs. future-scale:** MVP architecture above is sufficient through ~10K users given the near-zero compute cost per user. Future-scale considerations (only if usage patterns demand it): CDN-hosted WASM model files, WebGPU-accelerated filters, WebRTC-based optional team collaboration.

---

## 16. Data Model (conceptual)

- **User** — id, email, auth provider, created_at, plan
- **Subscription** — user_id, Stripe customer/sub id, plan, status, renewal_date
- **UsageCounter** — user_id, period, exported_minutes_used
- **Preset** — user_id, name, settings JSON (compression target, caption style, cut sensitivity)
- **ProjectMeta** — user_id, name, last_opened, cut_list JSON, local_only flag (video itself lives in browser storage/local disk, never server DB)

---

## 17. Security & Privacy

- Standard auth hardening (hashed credentials or OAuth-only, rate-limited login).
- Explicit, prominent documentation of what never leaves the device vs. what optionally does (Section 13) — this is the product's core trust surface and should be treated as a compliance-adjacent artifact, reviewed by counsel before claiming anything like "HIPAA-friendly" for the secondary ICP (Section 3) — **do not make compliance claims without legal review.**
- Cloud-caption audio retention policy must be explicit and minimal (delete after transcription).
- Standard account deletion/data export flows for GDPR/CCPA.

---

## 18. Key Risks

| Risk | Impact | Early signal | Mitigation |
|---|---|---|---|
| WASM/WebCodecs performance disappoints on real (not demo) footage | Medium (reduced from High by dropping 4K, but not eliminated) | Beta users report crashes/slowness on real files | Chunked processing is P0, not optional; broad device testing before public launch; 1080p/2GB input ceiling enforced at drop-time |
| MP4 remux after cuts produces desync'd audio/video, bad keyframes, or corrupt sample tables | High — silently broken exports destroy trust fast | Beta users report drift/glitches in exported files | Treat remux correctness as the core engineering risk (Section 9), not a byproduct of the resolution cut; needs dedicated test fixtures with known-good expected output |
| On-device caption accuracy too low to be usable | Medium — pushes users to cloud toggle, dilutes privacy story | Beta feedback on caption edits needed | Opt-in cloud captions positioned honestly, not hidden |
| Out-of-scope files (HEVC, MOV, 4K, VFR) frustrate users who don't read the constraints | Medium — bad first impression, support burden | Drop-time rejection rate high in beta | Clear, specific rejection messaging (Section 9) with a short "how to re-export" note, not a generic error |
| Organic/SEO channel underperforms the 200K-visitor assumption | High — directly threatens 3,000-user target | Month 3–4 traffic below plan | Shift to creator-affiliate channel earlier; low COGS allows some paid acquisition |
| Safari/Firefox WebCodecs gaps limit addressable browser share | Medium | Verify at build time | Software-encode fallback path, clearly messaged |
| Established competitors add "local processing" marketing even without true on-device compute | Medium | Competitor messaging changes | Lean on the live, provable demo widget — a claim you can watch happen beats a claim you read |

---

## 19. Open Questions

**Critical:** Can the MP4 remux step (timestamps, keyframes, sample tables, A/V sync) be made reliably correct across real-world 1080p footage from common recorders (Riverside, Zoom, OBS, phone cameras) — this is the core engineering risk regardless of the resolution cut, and should be validated with real test fixtures before the pipeline is trusted. Does WebCodecs hardware encode perform acceptably on real 1080p footage on mid-range/low-end hardware? Is 3,000 users achievable organically or does the plan require paid acquisition budget from month 1?

**Important:** What on-device Whisper model size balances first-run download time against caption accuracy? What's the actual current competitor pricing (needs live verification, not assumed)? How much of the launch narrative should lead with "1080p today, 4K coming" vs. omitting 4K until it ships, to avoid setting an expectation the MVP doesn't meet?

**Minor:** Exact compression preset targets per platform; exact free-tier minute cap (30 is a starting assumption, tune post-beta); exact timeline for the 4K post-MVP milestone (Section 26).

---

## 20. Definition of Done (MVP)

- [ ] Drop-time validation correctly accepts MP4/H.264/AAC ≤1080p ≤60fps ≤2GB and rejects everything else with a specific, actionable message
- [ ] Local decode, preview/scrub works on accepted files up to 2GB without tab crash
- [ ] Silence-detection cut suggestions generate in-browser, editable (accept/reject/adjust)
- [ ] MP4 remux after cuts produces correct, verified A/V sync, keyframes, and sample tables against known test fixtures — not just "plays back without obvious glitches"
- [ ] On-device captions generate and burn in
- [ ] Compression presets export to 720p/1080p via WebCodecs hardware path with software fallback
- [ ] Export downloads locally with zero video/audio bytes sent to any server (verifiable via network tab — this should be demonstrable, not just claimed)
- [ ] Auth, Stripe billing, usage metering functional end-to-end
- [ ] Free-tier cap enforcement with inline, non-blocking upgrade prompt

---

## 21. Post-MVP Milestone: 4K Support (P1)

4K is deferred, not abandoned. Once the 1080p pipeline is validated on real footage (Section 9's DoD, plus a stretch of real beta usage with no unresolved remux-correctness bugs), 4K becomes the next milestone, in this order: (1) raise the drop-time resolution ceiling and re-test WebCodecs hardware decode/encode at 4K on the existing device matrix; (2) re-test chunked-processing memory behavior specifically, since 4K's ~4× pixel count is the primary driver of the crash risk this document cuts from the MVP; (3) surface 4K as a Pro-tier capability (Section 11) rather than launching it to all tiers at once, so real usage data comes from the more forgiving power-user segment first. Do not schedule 4K work before the MP4-remux-correctness question in Section 19 is closed — resolution is the wrong axis to scale first if cuts still desync audio at 1080p.