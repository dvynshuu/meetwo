# Meetwo V3.1 — Media Architecture & Quality Specification

Meetwo V3.1 is engineered specifically to deliver studio-grade audio and video for private groups of 2–6 friends. Every media decision prioritizes natural intelligibility, low latency, connection stability, and presentation clarity.

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
- **VAD with Speech Hangover Hysteresis**:
  - Speech threshold: 14%
  - Silence threshold: 9%
  - Hangover duration: 450ms (prevents speaking indicator flickering between syllables).
- **Throttled Telemetry**: Level updates are throttled to ~28Hz with change gating to prevent unnecessary React re-renders.
- **Hardware Diagnostic Suite**: Stereo harmonic test chime (523Hz C5 → 659Hz E5) verifies speaker routing and volume via `setSinkId`.

---

## 2. Video Pipeline (1080p Target & Adaptive Simulcast)

### Capture & Target Resolution
- **Target**: `1920 × 1080` @ 30 FPS.
- **Negotiation Ladder**:
  - `1080p` (`1920x1080 @ 30fps`, 2.5 Mbps)
  - `720p` (`1280x720 @ 30fps`, 1.0 Mbps)
  - `480p` (`640x480 @ 30fps`, 500 kbps)
  - `360p` (`480x360 @ 24fps`, 300 kbps)

### Video Quality Stability & Hysteresis
- Rapid resolution oscillation (e.g. 1080p → 720p → 1080p) is strictly prevented using a **4-second minimum quality hold time** and hysteresis threshold checks before adjusting sender bitrate.
- **Audio-First Rule**: Under adverse network conditions (packet loss > 5% or RTT > 220ms), sender video bitrate is throttled first (down to 300 kbps) to ensure audio intelligibility remains completely uncompromised.

---

## 3. Independent Screen Sharing & Dual-Stream Presentation

### 4-Track Architecture
Screen sharing is decoupled from camera video:
```text
┌───────────────────────────────┐
│         MediaSession          │
└───────┬───────────────┬───────┘
        │               │
  Camera Track    Microphone Track
        │               │
 Screen Video    Screen Audio
```
- Camera is **never replaced** by screen sharing. Both can be transmitted and received concurrently.
- **Screen Share Quality**: Requested with `width: { ideal: 1920, max: 3840 }`, `height: { ideal: 1080, max: 2160 }`, and `displaySurface: 'monitor'` for razor-sharp text and code readability.
- **Dual Layout**: When a user shares their screen, the screen share dominates the main viewport while the presenter's camera tile remains visible in the participant strip alongside other friends.

---

## 4. Primary Transport: LiveKit SFU

- **Role**: Primary production media path (`LiveKitSFUAdapter`).
- **Selective Forwarding**: Transmits local media once; the SFU selectively forwards streams to participants based on active speaker and layout focus.
- **AdaptiveStream & Dynacast**: Automatically requests lower-resolution simulcast layers for small thumbnail tiles and high-resolution layers for spotlighted/pinned participants.
- **Independent Screen Publications**: Published with `Track.Source.ScreenShare` and `Track.Source.ScreenShareAudio`.
- **Dynamic Token Negotiation**: Managed via server-side token endpoint (`livekitToken.ts`) to avoid exposing API secrets client-side.

---

## 5. Development & Fallback Transport: Enhanced P2P Mesh

- **Role**: Local development, multi-tab sandboxing, and emergency zero-config fallback (`PeerConnectionManager`).
- **Signaling**: Perfect Negotiation pattern (polite/impolite peers, deterministic glare handling) running over Supabase Realtime Broadcast or local `BroadcastChannel`.
- **In-Call Stream Isolation**: Employs dual-stream routing to maintain independent camera and screen streams per peer session.

---

## 6. Truthful Telemetry & Real Codec Reporting (No Fake Metrics)

Meetwo V3.1 enforces a strict policy: **never fabricate or substitute healthy-looking defaults for unavailable metrics**.

- **No Synthetic Numbers**: Metrics like RTT, Packet Loss, Jitter, Bitrate, and FPS remain `undefined` until actually measured by WebRTC `getStats()`. In the UI, these explicitly render as **"Unavailable"** or `--`.
- **Real Codec Extraction**: Rather than hardcoding codec strings, Meetwo resolves actual negotiated codec MIME types from `RTCStatsReport` (matching `inbound-rtp.codecId` and `outbound-rtp.codecId` against `report.type === 'codec'`). If codec info is not exposed by the browser, it reports `Unavailable`.
- **Round-Trip Time (RTT)**: Extracted strictly from nominated / succeeded candidate pairs.
- **Instantaneous Bitrate**: Computed exclusively from bytes delta over elapsed time (`kbps` / `Mbps`).
- **Participant-Level Quality**: LiveKit's `ConnectionQualityChanged` events and per-peer WebRTC sessions track health per participant instead of assuming aggregate room conditions.

### Quality Classification Model:
| Quality | Conditions |
| :--- | :--- |
| **Excellent** | RTT < 100ms and Packet Loss < 2% |
| **Good** | RTT < 200ms and Packet Loss < 5% |
| **Fair** | RTT < 350ms and Packet Loss < 12% |
| **Poor** | RTT ≥ 350ms or Packet Loss ≥ 12% |
| **Reconnecting** | Signaling state reconnecting or ICE disconnect |

---

## 7. Device Switching & Hardware Resilience

- **Seamless Device Switching**: Switching cameras or microphones invokes `replaceTrack` on active senders without dropping the call or renegotiating.
- **Hardware Disconnect Detection**: `track.onended` listeners detect hardware removal (unplugged USB mic or webcam) and transition the track to muted state gracefully without call interruption.
- **Audio Output Routing**: Routes remote audio to selected output device via HTMLMediaElement `setSinkId`.

---

## 8. Stage Rooms: Security & Listener Defaults

- **Strict Listener Default**: Participants joining a Stage room default to **listener** (`isStageSpeaker: false`). Unknown roles never default to speaker.
- **Explicit Role Promotion**: Only explicit moderation state promotes a participant to speaker.
- **Targeted Moderation Actions**: All stage moderation signals (`invite`, `demote`, `lower-hand`) strictly carry and target the selected participant ID.
- **No Synthetic Audience**: Stage room state is derived 100% from actual connected peers; synthetic audience counts and fake participants are prohibited.

