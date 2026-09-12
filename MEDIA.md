# Meetwo V4 — Media Architecture & Quality Specification

Meetwo V4 is engineered specifically to deliver truthful, reliable, studio-grade audio and video for private groups of 2–6 friends. Every media decision prioritizes natural intelligibility, low latency, connection stability, truthful telemetry, and presentation clarity.

---

## 1. High-Fidelity Audio Pipeline

### Codec & Voice Profile
- **Codec**: Opus 48kHz.
- **Channel Configuration**: Mono voice (`channelCount: 1`) for conversational speech. Eliminates phase cancellation, reduces CPU load, and optimizes bandwidth allocation for Opus voice encoding.
- **SDP Munging (`mungeOpusSDP`)**:
  - `useinbandfec=1`: In-band Forward Error Correction for zero-dropout voice under packet loss up to 15%.
  - `usedtx=1`: Discontinuous Transmission saves bandwidth during pauses and natural silence.
  - `minptime=10`: Low-latency packet framing (10ms) for instantaneous, natural conversation.
  - `maxaveragebitrate=96000`: 96 kbps allocation ensures broadcast-quality speech intelligibility.
  - `stereo=0; sprop-stereo=0`: Enforces mono voice channel mapping.

### Web Audio Processing (`AudioDSPManager`)
- **Passive Monitoring**: Web Audio `AnalyserNode` monitors speech frequency bands (85Hz – 3500Hz) passively. It is strictly never connected to `AudioContext.destination` to prevent self-echo.
- **Input Gain Calibration**: Realtime `GainNode` adjusts microphone sensitivity (0% to 200%) via high-precision audio parameter ramping.
- **Adaptive Noise Floor Tracking**:
  - Dynamically calculates the ambient background noise floor during silence:
    `noiseFloor = noiseFloor * 0.96 + currentLevel * 0.04`
  - Adapts speech threshold dynamically relative to ambient noise, preventing background noise from falsely activating speech indicators.
- **VAD with Speech Hangover Hysteresis**:
  - Speech threshold: Dynamically calculated based on noise floor + hysteresis
  - Hangover duration: 450ms (prevents speaking indicator flickering between syllables).
- **Throttled Telemetry**: Level updates are throttled to ~28Hz with change gating to prevent unnecessary React re-renders.
- **Hardware Diagnostic Suite**: Stereo harmonic test chime (523Hz C5 → 659Hz E5) verifies speaker routing and volume via `setSinkId`.

---

## 2. Video Pipeline (1080p Target & Per-Peer Adaptation)

### Capture & Target Resolution
- **Target**: `1920 × 1080` @ 30 FPS.
- **Negotiation Ladder**:
  - `1080p` (`1920x1080 @ 30fps`, 2.5 Mbps, `scaleResolutionDownBy: 1.0`)
  - `720p` (`1280x720 @ 30fps`, 1.2 Mbps, `scaleResolutionDownBy: 1.5`)
  - `480p` (`640x480 @ 30fps`, 600 kbps, `scaleResolutionDownBy: 2.0`)
  - `360p` (`480x360 @ 24fps`, 300 kbps, `scaleResolutionDownBy: 3.0`)

### Per-Peer Sender Adaptation (Direct Mesh)
- Global adaptation timers have been replaced with isolated per-peer timestamps:
  `peerBitrateAdaptTimes: Map<string, number>`
- If Friend A experiences network degradation, sender encoding parameters for Friend A are stepped down while high-definition video is maintained for Friends B and C.
- **Audio-First Rule**: Under adverse network conditions (packet loss > 5% or RTT > 220ms), sender video bitrate is throttled first (down to 300 kbps) to ensure audio intelligibility remains completely uncompromised.
- **Hysteresis**: Minimum 4-second hold time prevents rapid, distracting resolution oscillation.

---

## 3. Independent Screen Sharing & Dual-Stream Presentation

### 4-Track Architecture
Screen sharing is decoupled from camera video:
```text
┌─────────────────────────────────────────────────┐
│                  MediaSession                   │
└───────┬───────────────┬─────────────────┬───────┘
        │               │                 │
  Camera Track    Microphone Track   Screen Video   Screen Audio
```
- Camera is **never replaced or disabled** by screen sharing. Both are transmitted and received concurrently.
- Re-entrance guards prevent concurrent conflicting `getDisplayMedia` prompts.
- **Screen Share Quality**: Requested with `width: { ideal: 1920, max: 3840 }`, `height: { ideal: 1080, max: 2160 }`, and `displaySurface: 'monitor'` for razor-sharp text and code readability.
- **Dual Layout**: When a user shares their screen, the screen share dominates the main viewport while the presenter's camera tile remains visible in the participant strip alongside other friends.

---

## 4. Truthful Telemetry Mandate

Meetwo V4 strictly bans fabricated defaults in telemetry and UI:
- **Initial State**: Always `quality: 'unknown'`. UI displays *"Measuring connection…"*, never fake *"Excellent"*.
- **Codecs**: Audio and video codecs are reported strictly when measured by WebRTC `getStats()` (e.g. `opus`, `vp8`, `h264`). If unmeasured, they report `[Unavailable]`, never default guesses like `"Opus 48kHz"` or `"VP8 / H.264"`.
- **Bitrate**: Reported strictly when calculated from delta byte counters. If unmeasured, reports `"Measuring..."` rather than `"0 kbps"`.
- **Candidate Type**: Candidate pair type (`host`, `srflx`, `relay`) is extracted directly from the active candidate pair.

---

## 5. Transports

### Primary: LiveKit SFU (`LiveKitSFUAdapter`)
- Production media transport with selective forwarding, dynacast, and truthful `getStats()` polling.
- Independent screen publications with `Track.Source.ScreenShare` and `Track.Source.ScreenShareAudio`.

### Fallback: Enhanced P2P Mesh (`PeerConnectionManager`)
- W3C Perfect Negotiation with polite/impolite glare resolution.
- Per-peer sender track parameter adaptation.
- Multi-tab and offline sandbox support via `BroadcastChannel`.
