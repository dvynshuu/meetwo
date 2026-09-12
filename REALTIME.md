# Meetwo V3.1 — Realtime Signaling & State Synchronization

This document specifies the realtime communication architecture, signaling flows, and stage moderation protocols implemented in Meetwo V3.1.

---

## 1. Architecture Overview

Realtime responsibilities are strictly separated between application state and live media:

```text
                     MEETWO CLIENT
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
  APPLICATION STATE                       MEDIA LAYER
  (Supabase / PostgreSQL)                 (LiveKit SFU / WebRTC)
  ├── Auth & Profiles                     ├── Microphone (Mono Opus)
  ├── Servers & Channels                  ├── Camera (1080p Simulcast)
  ├── Chat Messages & Reactions           ├── Screen Share (4K/1080p)
  ├── Presence Status                     ├── Screen Audio
  └── Governance Logs                     └── Telemetry (RTT, Loss)
```

Live audio and video tracks are **never** routed through Supabase database tables.

---

## 2. P2P Signaling & Perfect Negotiation Protocol

In fallback and local development modes, peers establish direct WebRTC connections using the **W3C Perfect Negotiation Pattern**:

### Role Assignment:
```text
polite = localPeerId < remotePeerId
```
- **Polite Peer**: Yields to incoming offers during glare conditions (resets local description and accepts the remote offer).
- **Impolite Peer**: Ignores remote offers received while making an offer, resolving collision deterministically.

### Signal Message Schema (`PeerSignalMessage`):
```typescript
interface PeerSignalMessage {
  type:
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'join-room'
    | 'leave-room'
    | 'mute-state'
    | 'speaking-state'
    | 'hand-raise'
    | 'stage-role'
    | 'stage-invite'
    | 'stage-demote'
    | 'stage-hand-dismiss'
    | 'track-update';
  fromPeerId: string;
  toPeerId?: string;
  roomId: string;
  payload: any;
}
```

---

## 3. Stage Broadcast Moderation Protocol

Stage rooms allow hosts and speakers to broadcast audio/video to listeners while maintaining minimal network overhead for listeners.

### Targeted Moderation Signals:
Every moderation action explicitly targets the intended participant ID:

```text
Moderator (Sam)                        Attendee (Alex)
      │                                       │
      │  Alex raises hand                     │
      │◄──────────────────────────────────────│
      │                                       │
      │  Sam clicks "Invite to Stage"         │
      │  sendTargetedStageAction(alex,invite) │
      ├──────────────────────────────────────►│
      │                                       │
      │                                       │  Alex receives 'invite':
      │                                       │  stageRole -> 'speaker'
      │                                       │  isStageSpeaker -> true
      │                                       │  isHandRaised -> false
      │                                       │
```

| Action | Signal Type | Payload | Effect |
| :--- | :--- | :--- | :--- |
| **Invite to Stage** | `stage-invite` | `{ targetUserId }` | Promotes target attendee to Stage Speaker; clears hand raised status. Moderator state is unchanged. |
| **Move to Audience** | `stage-demote` | `{ targetUserId }` | Demotes target speaker to Listener. Disables broadcast tracks. |
| **Dismiss Hand** | `stage-hand-dismiss` | `{ targetUserId }` | Lowers the target attendee's hand in the speaker queue. |

---

## 4. Connection Lifecycle State Machine

```text
   IDLE
     │  joinVoiceRoom(roomId)
     ▼
INITIALIZING
     │  Acquire hardware tracks (mic/cam)
     ▼
 CONNECTING
     │  SFU connected / P2P ICE connected
     ▼
 CONNECTED ◄────────────────────────┐
     │                              │
     ├── High packet loss / RTT     │
     ▼                              │ Network recovered
  DEGRADED                          │
     │                              │
     ├── Network drop / ICE failed  │
     ▼                              │
RECONNECTING ───────────────────────┘
     │
     ├── Retries exceeded
     ▼
   FAILED
```

- **Degraded**: Audio is prioritized; video sender bitrate is stepped down with hysteresis hold time.
- **Reconnecting**: Controlled retry backoff triggers ICE restart without tearing down application state.
- **Cleanup**: On leaving, unmounting, or navigating away, local tracks are stopped, subscriptions closed, and event listeners unbound.
