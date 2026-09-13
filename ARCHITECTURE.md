# Meetwo V4 — System Architecture

Meetwo V4 is architected as a truthful, reliable, studio-grade real-time communication platform designed specifically for small private groups (roughly 2–6 people). It strictly decouples application data persistence from live WebRTC media delivery and enforces zero fabricated telemetry.

---

## 1. System Topology

```text
                    ┌───────────────────────────────┐
                    │         MEETWO CLIENT         │
                    └───────┬───────────────┬───────┘
                            │               │
                            ▼               ▼
                    ┌────────────────┐ ┌───────────────────────────────┐
                    │ App Data Layer │ │          Media Layer          │
                    └───────┬────────┘ └───────┬───────────────┬───────┘
                            │                  │               │
                            ▼                  ▼               ▼
                    ┌────────────────┐ ┌────────────────┐ ┌───────────────┐
                    │    Supabase    │ │  LiveKit SFU   │ │Enhanced P2P   │
                    │ (Auth, RLS, DB)│ │(Primary SFU    │ │Mesh (Fallback │
                    └────────────────┘ │ Transport)     │ │& Dev Sandbox) │
                                       └───────┬────────┘ └───────┬───────┘
                                               │                  │
                                  ┌────────────┼────────────┐     │
                                  ▼            ▼            ▼     ▼
                              Friend A     Friend B     Friend C (2–6 peers)
```

---

- **[DATABASE.md](DATABASE.md)**: Database schema, Supabase Postgres tables, RLS policies, Realtime CDC subscriptions, and modular service layer.
- **[SECURITY.md](SECURITY.md)**: LiveKit token JWT verification, authentication lifecycle, workspace invite protection, and track privacy.
- **[MEDIA.md](MEDIA.md)**: Opus audio DSP, adaptive VAD, per-peer video adaptation, 4-track presentation mode, and truthful telemetry.
- **[REALTIME.md](REALTIME.md)**: Perfect Negotiation signaling, Stage state machine, 5-state ReconnectionManager, and observability logging.

---

## 2. Core Subsystems

### A. Media Layer (`src/lib/webrtc/`)
- **`mediaSession.ts`**: Hardware abstraction managing `microphoneTrack`, `cameraTrack`, `screenShareTrack`, and `screenAudioTrack`. Implements device failover on unexpected hardware unplug events, re-entrance guards on screen share, and emits structured observability events.
- **`audioProcessing.ts`**: High-fidelity audio DSP featuring Opus SDP munging (48kHz mono, FEC, DTX), Web Audio AnalyserNode VAD with dynamic noise floor tracking (`noiseFloor * 0.96 + sample * 0.04`), 450ms speech hangover, and speaker diagnostic chime.
- **`transportAdapter.ts`**:
  - `LiveKitSFUAdapter`: Primary production transport handling selective forwarding, dynacast, independent screen share publishing, and truthful WebRTC `getStats()` polling. Codecs and candidate pairs are strictly measured or left `undefined`.
  - `ITransportAdapter`: Polymorphic interface enabling clean switching between SFU and direct engine.
- **`peerConnection.ts`**: Enhanced Direct Engine (P2P mesh) using Perfect Negotiation with polite/impolite glare resolution for zero-config offline sandboxing and emergency fallback. Features per-peer adaptation (`peerBitrateAdaptTimes: Map<string, number>`) isolating network drops to the degraded peer.
- **`reconnectionManager.ts`**: Dedicated 5-state connection lifecycle state machine (`connected`, `degraded`, `reconnecting`, `recovering`, `failed`) with exponential backoff, jitter, consecutive metric evaluation, and ICE restart triggers.
- **`observability.ts`**: Structured event logger recording lifecycle transitions (`call_started`, `transport_connected`, `device_disconnected`, etc.) with in-memory ring buffer, dev subscription, and JSON export.
- **`testHarness.ts`**: Automated verification test harness validating scenarios A through H (adaptation thresholds, per-peer isolation, truthful telemetry, stage authorization, reconnect backoff, device resilience).
- **`livekitToken.ts`**: Authenticated token negotiation service attaching the user's active Supabase session JWT to request scoped LiveKit tokens from Cloudflare Pages Function `/api/livekit-token`.

### B. Service Layer (`src/lib/services/`)
- **`storageService.ts`**: File upload handler with 25MB validation, Supabase Storage bucket integration, and data URL fallback.
- **`messageService.ts`**: Real Supabase message CRUD, attachment linking, and reaction handling.
- **`threadService.ts`**: Thread creation and message persistence with real-time sync.
- **`bookmarkService.ts`**: Saved messages persistence and bookmark toggling.
- **`forumService.ts`**: Forum post creation, reply management, and solution marking.
- **`dmService.ts`**: 1:1 and small-group direct chat persistence and real-time listeners.
- **`friendService.ts`**: Friend management, user search, and request handling.
- **`searchService.ts`**: Global multi-entity search across channels, messages, and forums.
- **`readStateService.ts`**: Attention tracking and unread message counters.

### C. State Management Layer (`src/app/providers/`)
- **`MediaContext.tsx`**: Central orchestrator managing call lifecycle states, truthful connection metrics (`quality: 'unknown'` initially), Stage state machine synchronization, device change notifications, diagnostics toggle (`Ctrl+Shift+D`), and simultaneous camera + screen sharing.
- **`AuthContext.tsx`**: Manages authentication sessions, profile state, and clean production logout (destroying session and resetting user to `null`).
- **`ServerContext.tsx` & `ChatContext.tsx`**: Workspaces, channels, all accessible channels (`allChannels`), categories, and realtime text chat.
- **`DMContext.tsx` & `InboxContext.tsx`**: Real Direct Messages, friends list, and mention notifications.

### D. Server-Authoritative Stage Layer (`src/lib/supabase/mockStore.ts`)
- Implements strict server-authoritative role verification:
  - `LISTENER -> REQUEST_SPEAK -> PENDING -> APPROVED -> SPEAKER`.
  - Host or moderator credentials verified before `approveSpeaker`, `denySpeaker`, or `demoteSpeaker` can execute.
  - Listener cannot spoof or elevate their own stage role.

### E. Video Presentation UI (`src/components/video/`)
- **`VideoGrid.tsx`**: Dynamic responsive grid with intelligent layouts for 1, 2, 3, 4, 5–6 friends. Supports presentation stage mode where screen share dominates the stage while the presenter's camera tile remains visible in the strip.
- **`VideoTile.tsx`**: Hardware-accelerated `<video>` tile with persistent DOM mounting, picture-in-picture, fullscreen, audio sink routing (`setSinkId`), active-speaker halo, and measured connection quality indicator.
- **`VideoControls.tsx`**: Split control buttons with quick-switch device menus, screen sharing toggle, realtime measured telemetry popover, and stream diagnostics toggle.
- **`PreJoinModal.tsx`**: Pre-call hardware verification preview with camera feed, real Web Audio microphone level meter, speaker device output selector, speaker test chime, and Pre-Call Readiness Checklist.
- **`DiagnosticsModal.tsx`**: Realtime developer diagnostics view featuring per-participant RTCPeerConnection metrics (RTT, loss, jitter, bitrate, packets, candidate pair, transport type), live observability log stream, JSON export, and test harness execution.
- **`StageRoom.tsx`**: Live stage broadcast layout with speaker cards, real audience grid, targeted attendee invitation queues, and network state banners.

---

## 3. Small-Group Optimization Model (2–6 Participants)

Rather than compromising quality for thousands of passive viewers, Meetwo V4 aggressively maximizes call quality for 2–6 friends:
- **Audio First**: Mono 48kHz Opus with in-band FEC guarantees clean, natural voice even through packet loss. Network degradation throttles video first, protecting voice.
- **1080p Video with Per-Peer Adaptation**: High-bitrate 1080p full HD video with 4-second hysteresis. Network issues with one peer do not degrade video sent to other healthy peers.
- **True Presentation Mode**: Both screen share and camera facecam broadcast simultaneously using an independent 4-track model.
- **Truthful Telemetry**: Initial quality state is strictly `unknown` ("Measuring connection…"). Codecs and bitrates are strictly measured or report `[Unavailable]`, never fabricated defaults.
