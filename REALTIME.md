# Meetwo V4 — Realtime Signaling & State Synchronization

This document specifies the realtime communication architecture, signaling flows, stage authorization state machines, and connection recovery protocols implemented in Meetwo V4.

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
  └── Stage Governance States             └── Measured Telemetry (RTT, Loss)
```

Live audio and video tracks are **never** routed through Supabase database tables.

---

## 2. Server-Authoritative Stage State Machine

Meetwo V4 implements a strict server-authoritative stage authorization model:

```text
   LISTENER
      │
      │ User calls requestToSpeak()
      ▼
REQUEST_SPEAK (Queue: handRaisedQueue.push(userId))
      │
      ├── Host/Mod approves: approveSpeaker(actorId, targetUserId)
      │   (Actor permissions strictly verified on store/server)
      ▼
   SPEAKER (speakers.push(userId), removed from handRaisedQueue)
      │
      ├── Host/Mod demotes: demoteSpeaker(actorId, targetUserId)
      │   or Speaker steps down
      ▼
   LISTENER (speakers.filter(id => id !== targetUserId))
```

### Authorization Rules
- **Listeners cannot self-promote**: Calling client-side functions without store/server approval fails.
- **Actor verification**: The actor performing `approveSpeaker`, `denySpeaker`, or `demoteSpeaker` must either be the stage channel host or possess `owner`, `admin`, or `moderator` roles in the server.
- **Queue management**: Raising a hand appends the user to `handRaisedQueue`. Approving or denying removes the user from the queue.

---

## 3. Dedicated Reconnection State Machine (`ReconnectionManager`)

Connection resilience is governed by a dedicated state machine with 5 discrete lifecycle states:

```text
      CONNECTED ◄───────────────────────────────┐
          │                                     │
          ├── Packet loss > 5% or RTT > 220ms   │
          │   (consecutive evaluations)         │ Consecutive healthy checks
          ▼                                     │
       DEGRADED ────────────────────────────────┤
          │                                     │
          ├── ICE disconnected / failed         │
          ▼                                     │
     RECONNECTING ─── ICE restart trigger ────► RECOVERING
          │                                         │
          ├── Max retries exceeded (delay cap 8s)   ├── Verification failed
          ▼                                         ▼
        FAILED ◄────────────────────────────────────┘
```

### Backoff & Jitter
- **Initial Delay**: 1000ms
- **Multiplier**: 1.5x exponential
- **Max Delay Cap**: 8000ms
- **Jitter**: ±20% randomized jitter prevents synchronized thundering herds on network reconnect.
- **Consecutive Metrics**: State transitions require consecutive evaluation cycles (e.g. 3 consecutive cycles for degraded; 2 for recovery) to prevent flip-flopping.

---

## 4. P2P Signaling & Perfect Negotiation Protocol

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

## 5. Structured Observability & Event Logging

Meetwo V4 records all connection and media events through `ObservabilityLogger`:
- **Events Logged**: `call_started`, `call_joined`, `call_left`, `transport_connected`, `transport_failed`, `reconnect_started`, `reconnect_success`, `device_changed`, `device_disconnected`, `screen_share_started`, `screen_share_stopped`, `quality_changed`, `stage_role_changed`.
- **In-Memory Ring Buffer**: Retains the last 150 events for real-time inspection in the Diagnostics Modal (`Ctrl+Shift+D`).
- **Export**: Generates full JSON diagnostic export files for post-call analysis.
