# Meetwo 🚀 (V3.1)
### Studio-Grade Realtime Communication & Media Platform for 2–6 Friends

Meetwo is a modern, high-performance real-time communication platform designed specifically to provide the highest-quality audio, 1080p video, and screen sharing experience for small private groups of 2–6 friends.

---

## 📖 Technical Documentation

- **[MEDIA.md](MEDIA.md)**: Deep dive into the Opus audio pipeline, 1080p video adaptation, independent screen sharing, LiveKit SFU, and real WebRTC telemetry.
- **[REALTIME.md](REALTIME.md)**: Specifications for Perfect Negotiation signaling, targeted Stage moderation protocols, and connection recovery state machines.
- **[ENVIRONMENT.md](ENVIRONMENT.md)**: Environment variable reference, security best practices, and deployment tiers (Development, Staging, Production).
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: High-level architectural diagrams, subsystem separation, and small-group optimization principles.

---

## 🌟 Key Features (V3.1 Media & Quality Highlights)

### 🎙️ 1. Studio-Quality Audio Engine
- **Opus 48kHz Mono Voice**: Conversational mono speech capture (`channelCount: 1`) maximizes bandwidth efficiency and intelligibility.
- **Packet Loss Resilience & DTX**: Enforces in-band Forward Error Correction (`useinbandfec=1`) and Discontinuous Transmission (`usedtx=1`) for crystal-clear voice even across degraded networks.
- **Web Audio DSP Pipeline**: Passive frequency-band VAD with 450ms speech hangover eliminates speaking indicator flicker without self-echo.
- **Hardware Diagnostic Suite**: Stereo harmonic test chime (523Hz → 659Hz) and `setSinkId` output device routing.

### 🎥 2. 1080p Full HD Video & Adaptive Simulcast
- **1080p Target**: Requests `1920x1080` @ 30 FPS with smooth adaptive negotiation (`1080p` → `720p` → `480p` → `360p`).
- **Quality Stability Hysteresis**: 4-second minimum quality hold time prevents rapid, distracting resolution oscillation.
- **Audio-First Degradation**: Intelligently throttles video bitrate first under packet loss, ensuring friends never lose audio clarity.

### 🖥️ 3. Independent 4-Track Screen Sharing (Presentation Mode)
- **Simultaneous Camera + Screen**: Screen sharing does not replace the camera track. Presenters can share full-resolution screen content while their camera facecam remains visible in the strip.
- **Text & Code Clarity**: Preserves 1080p/4K resolution and sharp text rendering with `displaySurface: 'monitor'`.
- **Screen Audio**: Transmits system/tab audio concurrently where supported by the browser.

### ⚡ 4. Primary SFU Transport & Resilient P2P Fallback
- **LiveKit SFU Integration**: Primary production transport (`LiveKitSFUAdapter`) featuring server-side selective forwarding, dynacast, and adaptive streaming.
- **Dynamic Token Negotiation**: Secure server-side token minting via `livekitToken.ts` without client-side API secret exposure.
- **Real Connection Telemetry**: Measures genuine candidate-pair RTT, packet loss, jitter, and instantaneous bitrate from WebRTC `getStats()`. Zero fake metrics.
- **Enhanced P2P Mesh**: Zero-config offline and multi-tab fallback powered by W3C Perfect Negotiation.

### 📻 5. True Stage Broadcast Rooms
- **Real Participants Only**: Strictly zero simulated or bot participants in production.
- **Targeted Moderation**: Invitations and hand dismissals target explicit user IDs (`inviteToStage(userId)`), eliminating self-targeting bugs.
- **Low-Overhead Audience**: Prioritizes speaker bandwidth; audience members consume minimal compute and network resources.

### 📁 6. Community & Messaging Infrastructure
- **Channel Hierarchy**: Collapsible categories for text channels, voice/video hangouts, live stages, and forum discussions.
- **Rich Messaging**: Markdown support, code blocks, quote replies, emoji reactions, message pinning, and bookmarks.
- **Global Command Palette (`Ctrl+K`)**: Quick navigation across servers, channels, and system actions.

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

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

For full environment documentation, refer to **[ENVIRONMENT.md](ENVIRONMENT.md)**.

---

## 📄 License

MIT License. Designed for communities and private developer groups.
