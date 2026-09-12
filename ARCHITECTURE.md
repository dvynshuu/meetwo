# Meetwo V3.1 — System Architecture

Meetwo V3.1 is architected as a dual-layer realtime application, strictly decoupling application data persistence from live WebRTC media delivery.

---

## 1. System Topology

```text
                    ┌───────────────────────────────┐
                    │         MEETWO CLIENT         │
                    └───────┬───────────────┬───────┘
                            │               │
                            ▼               ▼
                   ┌────────────────┐ ┌────────────────┐
                   │ App Data Layer │ │  Media Layer   │
                   └───────┬────────┘ └───────┬────────┘
                           │                  │
                           ▼                  ▼
                   ┌────────────────┐ ┌────────────────┐
                   │    Supabase    │ │  LiveKit SFU   │
                   │ (Auth, RLS, DB)│ │(Selective Media│
                   └────────────────┘ │  Forwarding)   │
                                      └───────┬────────┘
                                              │
                                 ┌────────────┼────────────┐
                                 ▼            ▼            ▼
                             Friend A     Friend B     Friend C (up to 6)
```

---

## 2. Core Subsystems

### A. Media Layer (`src/lib/webrtc/`)
- **`mediaSession.ts`**: Hardware abstraction managing `microphoneTrack`, `cameraTrack`, `screenShareTrack`, and `screenAudioTrack`. Implements device failover on unexpected hardware unplug events.
- **`audioProcessing.ts`**: High-fidelity audio DSP featuring Opus SDP munging (48kHz mono, FEC, DTX), Web Audio AnalyserNode VAD with 450ms speech hangover, and speaker diagnostic chime.
- **`transportAdapter.ts`**:
  - `LiveKitSFUAdapter`: Primary production transport handling selective forwarding, dynacast, independent screen share publishing, and real WebRTC `getStats()` polling.
  - `ITransportAdapter`: Polymorphic interface enabling clean switching between SFU and direct engine.
- **`peerConnection.ts`**: Enhanced Direct Engine (P2P mesh) using Perfect Negotiation with polite/impolite glare resolution for zero-config offline sandboxing and emergency fallback.
- **`livekitToken.ts`**: Server-side token negotiation service preventing client exposure of server API secrets.

### B. State Management Layer (`src/app/providers/`)
- **`MediaContext.tsx`**: Central orchestrator managing call lifecycle states (`idle`, `connecting`, `connected`, `degraded`, `reconnecting`, `failed`), real connection metrics, targeted stage moderation, and simultaneous camera + screen sharing.
- **`AuthContext.tsx`**: Manages authentication sessions, profile state, and clean production logout (destroying session and resetting user to `null`).
- **`ServerContext.tsx` & `ChatContext.tsx`**: Channel categories, threads, bookmarked messages, and realtime text chat.

### C. Video Presentation UI (`src/components/video/`)
- **`VideoGrid.tsx`**: Dynamic responsive grid with intelligent layouts for 1, 2, 3, 4, 5–6 friends. Supports presentation stage mode where screen share dominates the stage while the presenter's camera tile remains visible in the strip.
- **`VideoTile.tsx`**: Hardware-accelerated `<video>` tile with persistent DOM mounting, picture-in-picture, fullscreen, audio sink routing (`setSinkId`), active-speaker halo, and measured connection quality indicator.
- **`VideoControls.tsx`**: Split control buttons with quick-switch device menus, screen sharing toggle, and realtime telemetry popover displaying RTT, packet loss, jitter, bitrate, and codec details.
- **`PreJoinModal.tsx`**: Pre-call hardware verification preview with camera feed, real Web Audio microphone level meter, and speaker output test chime.
- **`StageRoom.tsx`**: Live stage broadcast layout with speaker cards, real audience grid, and targeted attendee invitation queues.

---

## 3. Small-Group Optimization Model (1–6 Participants)

Rather than compromising quality for thousands of passive viewers, Meetwo V3.1 aggressively maximizes call quality for 2–6 friends:
- **Audio First**: Mono 48kHz Opus with in-band FEC guarantees clean, natural voice even through packet loss.
- **1080p Video**: High-bitrate 1080p full HD video with 4-second hysteresis to prevent resolution fluttering.
- **True Presentation Mode**: Both screen share and camera facecam broadcast simultaneously without forcing users to choose between being seen and sharing their screen.
