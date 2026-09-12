# Meetwo 🚀 (V4)
### Truthful, Reliable, Studio-Grade Communication Platform for 2–6 Friends

Meetwo V4 is a premium, lightweight real-time communication platform engineered specifically for small private groups (2–6 people). Guided by the master principle: **zero new features until existing audio, video, realtime, permissions, telemetry, and failure recovery are trustworthy.**

---

## 📖 Technical Documentation

- **[MEDIA.md](MEDIA.md)**: Deep dive into the Opus audio pipeline, per-peer video adaptation, truthful telemetry mandate, independent 4-track screen sharing, and LiveKit SFU.
- **[REALTIME.md](REALTIME.md)**: Specifications for Perfect Negotiation signaling, server-authoritative Stage state machine, 5-state ReconnectionManager, and structured observability logging.
- **[ENVIRONMENT.md](ENVIRONMENT.md)**: Environment variable reference, security constraints, and deployment tiers (Development, Staging, Production).
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: High-level architectural topology, subsystem separation, and small-group optimization principles.

---

## 🌟 Key Subsystems (V4 Production Hardening)

### 🎙️ 1. Studio-Quality Audio Engine & Adaptive VAD
- **Opus 48kHz Mono Voice**: Conversational mono speech capture (`channelCount: 1`) maximizes bandwidth efficiency and intelligibility.
- **Packet Loss Resilience & DTX**: Enforces in-band Forward Error Correction (`useinbandfec=1`) and Discontinuous Transmission (`usedtx=1`) for crystal-clear voice even across degraded networks.
- **Dynamic Noise Floor Adaptation**: Background ambient noise is continuously tracked during quiet frames (`noiseFloor = noiseFloor * 0.96 + sample * 0.04`), dynamically adapting speech thresholds relative to room acoustics.
- **Speech Hangover Hysteresis**: 450ms speech hangover eliminates speaking indicator flicker between syllables.
- **Hardware Diagnostic Suite**: Stereo harmonic test chime (523Hz → 659Hz) and `setSinkId` speaker routing.

### 🎥 2. Truthful Telemetry & Per-Peer Video Adaptation
- **Zero Fabricated Telemetry**: Initial connection quality is strictly `unknown` (UI shows *"Measuring connection…"*, never fake *"Excellent"*). Codecs and bitrates are strictly measured or report `[Unavailable]`, never default guesses.
- **Per-Peer Adaptation Isolation**: Global adaptation timers are replaced with `peerBitrateAdaptTimes: Map<string, number>`. Packet loss or jitter on one peer triggers video sender adaptation exclusively for that peer without degrading streams to healthy peers.
- **Audio-First Degradation**: Packet loss > 5% or RTT > 220ms steps down video bitrate (2.5Mbps → 1.2Mbps → 600kbps → 300kbps) to protect audio intelligibility at all costs.

### 🖥️ 3. Independent 4-Track Screen Sharing (Presentation Mode)
- **Simultaneous Camera + Screen**: Screen sharing does not replace the camera track. Presenters can share full-resolution screen content while their camera facecam remains visible in the strip.
- **4-Track Separation**: Camera video, microphone audio, screen video, and screen audio operate on separate independent tracks with re-entrance guards.
- **Text & Code Clarity**: Preserves 1080p/4K resolution and sharp text rendering with `displaySurface: 'monitor'`.

### 🔄 4. 5-State Reconnection Engine (`ReconnectionManager`)
- **Discrete Lifecycle States**: `connected`, `degraded`, `reconnecting`, `recovering`, `failed`.
- **Exponential Backoff with Jitter**: Reconnection attempts scale exponentially with a max delay cap of 8000ms and ±20% randomized jitter.
- **Consecutive Evaluation Filtering**: Requires consecutive cycles of degraded or recovered metrics before triggering transitions, preventing flip-flopping.
- **ICE Restart Triggers**: Automatically initiates ICE renegotiation when disconnected without tearing down application state.

### 🛡️ 5. Server-Authoritative Stage Security
- **State Machine Verification**: `LISTENER -> REQUEST_SPEAK -> PENDING -> APPROVED -> SPEAKER`.
- **Permission Enforcement**: Host and moderator roles are strictly validated store/server-side. Listeners cannot spoof or self-promote their stage role.
- **Targeted Moderation**: Invitations and hand dismissals target explicit user IDs (`inviteToStage(userId)`).

### 🔍 6. Stream Diagnostics & Automated Test Harness
- **Realtime Diagnostics Modal (`Ctrl+Shift+D`)**: Live inspection of participant RTCPeerConnection metrics (RTT, loss, jitter, bitrate, packets, candidate pair, transport type).
- **Structured Observability Log Stream**: Real-time event feed with filtering and one-click JSON diagnostic export.
- **Verification Test Harness**: Built-in test suite programmatically verifying scenarios A through H (thresholds, per-peer isolation, truthful telemetry, stage authorization, reconnect backoff, device resilience).

### 🎧 7. Pre-Call Readiness Checklist & Device Resilience
- **Pre-Call Verification**: Complete checklist verifying Camera ✓, Microphone ✓, Audio Output ✓, Network Ready ✓.
- **Speaker Device Selection**: Audio output dropdown routed via `setSinkId` with interactive chime test.
- **Device Unplug Resilience**: Auto-detects hardware disconnection, gracefully falls back to default devices, and alerts the user with non-intrusive toasts.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS Design Tokens (Obsidian Dark Mode, Glassmorphism)
- **Icons**: Lucide React
- **Media Transports**: LiveKit Client SFU + Native WebRTC RTCPeerConnection (W3C Perfect Negotiation)
- **Audio Processing**: Web Audio API (AnalyserNode, GainNode, OscillatorNode)
- **Data & Realtime**: Supabase (PostgreSQL with RLS & Realtime) + Built-in multi-tab MockStore fallback

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/dvynshuu/meetwo.git
   cd meetwo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. Build for production:
   ```bash
   npm run build
   ```

5. Run diagnostics test harness:
   Press `Ctrl+Shift+D` in any call, navigate to the **Automated Test Harness** tab, and click **Run All Scenarios (A–H)**.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your LiveKit and Supabase endpoints as detailed in [ENVIRONMENT.md](ENVIRONMENT.md).
