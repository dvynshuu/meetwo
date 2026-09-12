# meetwo — Design System & UI/UX Architecture

`meetwo` is a calm, modern, and human communication platform designed for small teams and private groups (2–6 people). It strictly rejects the frantic, hyper-gamified aesthetics of gaming chat apps (neon glows, purple gradients, pill-shaped UI everywhere, floating blobs) in favor of an architectural, focused, and quiet digital environment.

---

## 1. Brand Philosophy & Identity

### 1.1 The Core Ethos
- **Calm by Default**: Communication interfaces should recede into the background. Noise, intrusive telemetry, and bright rainbow gradients are eliminated.
- **Lowercase Identity**: The product name is strictly formatted as **`meetwo`** (all lowercase) in all typography, copy, and code surfaces.
- **Architectural Surfaces**: Rather than flat black or generic gray, `meetwo` employs a precise **4-level Mineral Graphite** surface system with high-contrast active accents.
- **Truthful Information**: Metrics (latency, bitrate, quality) are displayed discreetly without loud, constantly flickering numbers in primary chrome.
- **Rectangular-Rounded Geometry**: Strict radii (4px, 6px, 8px, 12px) create a stable, intentional rhythm, completely avoiding ubiquitous 9999px pills.

### 1.2 Anti-Patterns Banished
| Anti-Pattern | Reason for Elimination | meetwo Replacement |
| :--- | :--- | :--- |
| Discord purple gradients (`#6366F1`, `#8B5CF6`) | Generic gaming clone appearance | **Electric Mint (`#10E7B2`)** & **Mineral Graphite** |
| Neon green box-shadow speaking halos | Visual distraction, eye fatigue | **Crisp 2px mint border ring (`0 0 0 2px var(--accent)`)** |
| 9999px pill shapes everywhere | Childish, sloppy UI rhythm | **Strict geometric radii (`--radius-sm: 6px`, `--radius-md: 8px`)** |
| Raw telemetry in primary header (`24ms RTT`) | Unnecessary technical clutter | **Quiet status indicator (`● Good connection` with hover popover)** |
| Giant circular video control buttons | Dominate the screen, obscure content | **Floating 40px square-rounded graphite toolbar** |
| Rainbow user role colors | Visual chaos in member lists | **Monochrome scannable hierarchy with single mint owner badge** |

### 1.3 Brandmark
The `meetwo` brandmark consists of geometric converging focal nodes enclosed in a Mineral Obsidian base (`#0A0C10`), with dual nodes rendered in **Electric Mint** (`#10E7B2`) and **Subtle Sky** (`#38BDF8`), symbolizing focused, natural connection between human participants.

---

## 2. Design Tokens Architecture (`src/styles/tokens.css`)

### 2.1 Color Palette & Surface Hierarchy

```text
Level 0: #0A0C10 (--bg-app) ────────── Root frame & letterbox base
  Level 1: #0E121B (--bg-sidebar-servers) ─── Primary workspace rail (56px)
    Level 2: #131720 (--bg-sidebar-channels) ── Channel sidebar & member list (240px)
      Level 3: #181D28 (--bg-main, --bg-surface) ─ Chat viewport & video stage
        Level 4: #1E2533 (--bg-overlay, --bg-surface-raised) ─ Modals, popovers & dropdowns
```

#### CSS Token Definitions:
```css
:root {
  /* Mineral Graphite Surfaces */
  --bg-app: #0A0C10;              /* Level 0: Root app backdrop */
  --bg-sidebar-servers: #0E121B;  /* Level 1: Primary navigation rail */
  --bg-sidebar-channels: #131720; /* Level 2: Channel sidebar & member lists */
  --bg-main: #181D28;              /* Level 3: Center content canvas */
  --bg-surface: #181D28;           /* Level 3: Cards, input containers, tiles */
  --bg-surface-hover: #1E2533;     /* Hover state for interactive cards */
  --bg-surface-active: #242B3B;    /* Active state / selected items */
  --bg-surface-raised: #1E2533;    /* Level 4: Floating menus & popovers */
  --bg-overlay: #1E2533;           /* Level 4: Modal content background */

  /* Primary Accent: Electric Mint */
  --accent: #10E7B2;
  --accent-hover: #0DCA9B;
  --accent-active: #0BAF86;
  --accent-light: #4EEDC4;
  --accent-soft: rgba(16, 231, 178, 0.12);
  --accent-subtle: rgba(16, 231, 178, 0.12);
  --accent-border: rgba(16, 231, 178, 0.28);
  --accent-glow: rgba(16, 231, 178, 0.25);
  --text-on-accent: #0A0C10;       /* High-contrast dark text on bright mint */

  /* Secondary Accent: Subtle Sky */
  --sky: #38BDF8;
  --sky-hover: #0EA5E9;
  --sky-soft: rgba(56, 189, 248, 0.12);

  /* Semantic State Colors */
  --status-online: #10E7B2;
  --status-idle: #FBBF24;
  --status-dnd: #FB7185;
  --status-offline: #64748B;

  /* Destructive: Warm Coral */
  --danger: #FB7185;
  --danger-hover: #F43F5E;
  --danger-surface: rgba(251, 113, 133, 0.12);
  --danger-border: rgba(251, 113, 133, 0.25);
  --coral: #FB7185;
  --coral-soft: rgba(251, 113, 133, 0.12);

  /* Warning: Amber Gold */
  --warning: #FBBF24;
  --warning-surface: rgba(251, 191, 36, 0.12);

  /* Typography Colors */
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --text-dim: #475569;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-medium: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.20);
  --border-focus: var(--accent);
  --border-accent: rgba(16, 231, 178, 0.4);
}
```

### 2.2 Typography Hierarchy
- **Display Font (`--font-display`)**: `Plus Jakarta Sans`, sans-serif (Weights: 600, 700). Used for headers, brandmark, and modal titles.
- **Interface Font (`--font-ui`)**: `Inter`, sans-serif (Weights: 400, 500, 600). Used for channel labels, message text, user names, and buttons.
- **Monospace Font (`--font-mono`)**: `JetBrains Mono`, monospace (Weights: 400, 500, 600). Used for WebRTC telemetry, codecs, code snippets, timestamps, and shortcuts.

### 2.3 Strict Geometric Radii
```css
--radius-xs: 4px;   /* Tags, chips, reaction pills, mini status indicators */
--radius-sm: 6px;   /* Buttons, inputs, channel items, message hover containers */
--radius-md: 8px;   /* Cards, video tiles, workspace rail icons, quick menus */
--radius-lg: 12px;  /* Modals, popovers, floating video toolbar */
--radius-pill: 9999px; /* Reserved ONLY for live presence status dots */
```

### 2.4 Shadows & Elevations
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.65);
--shadow-speaking: 0 0 0 2px var(--accent); /* High-precision active speaker ring */
```

---

## 3. Spatial Layout & Navigation System

### 3.1 4-Column Layout Architecture
```text
┌────────────┬──────────────────┬──────────────────────────────────────┬──────────────────┐
│  Primary   │    Workspace     │             Top App Bar              │   Member List    │
│  Nav Rail  │ Channel Sidebar  ├──────────────────────────────────────┤    (Optional)    │
│            │                  │                                      │                  │
│    56px    │      240px       │          Main Content Pane           │      240px       │
│  Level 1   │     Level 2      │          (Chat, Video, Stage)        │     Level 2      │
│            │                  │                Level 3               │                  │
│            ├──────────────────┤                                      │                  │
│            │     User Bar     │                                      │                  │
└────────────┴──────────────────┴──────────────────────────────────────┴──────────────────┘
```

### 3.2 Component Details
1. **Primary Navigation Rail (`ServerSidebar.tsx`)**:
   - 56px width, Level 1 Mineral Graphite (`#0E121B`).
   - Top brand anchor with geometric `meetwo` nodes.
   - Square-rounded workspace icons (`40px x 40px`, `border-radius: var(--radius-md)`).
   - Clean active indicator: a 3px vertical Electric Mint bar on the left edge (`height: 22px`).
2. **Channel Sidebar (`ChannelSidebar.tsx`)**:
   - 240px width, Level 2 Mineral Graphite (`#131720`).
   - Collapsible categories with subtle carets (`ChevronDown`, `ChevronRight`).
   - Channels partitioned by semantic icons: `#` text, `Volume2` voice, `Radio` stage, `MessagesSquare` forum.
   - Active channel indicated with a subtle surface background and a 3px mint left accent notch.
3. **Top App Bar (`TopAppBar.tsx`)**:
   - 48px height, de-cluttered.
   - Left: Channel name, channel topic separated by a clean graphite divider.
   - Right: Discreet connection health pill (`● Good connection` with hover popover for detailed RTT/packet loss/jitter), Quick Jump `⌘K` shortcut trigger, and member toggle.
4. **User Status Bar (`UserBar.tsx`)**:
   - Fixed at the bottom of the channel sidebar.
   - Avatar with status badge, display name, `@username`, and custom emoji status.
   - Level 4 status menu popup for setting custom status and presence (Online, Away, DND, Offline).
   - Quick mute and settings trigger buttons.

---

## 4. Real-Time Video & Media Presentation

### 4.1 Floating Video Toolbar (`VideoControls.tsx`)
- **Positioning**: Floating 16px above the bottom viewport, horizontally centered.
- **Surface**: Level 3/4 surface (`#181D28`), `1px solid var(--border-medium)`, `box-shadow: var(--shadow-lg)`.
- **Buttons**:
  - 40px square-rounded buttons (`var(--radius-sm)`).
  - Split audio and video buttons with dedicated chevrons opening quick device selection menus.
  - Active muted states use warm coral tint (`var(--danger-surface)` with `var(--danger)` icon).
  - Disconnect button: Warm coral surface with red tooltip semantics.
  - Connection health pill: Compact 38px button matching toolbar radius (`var(--radius-sm)`), opening truthful WebRTC telemetry popover.

### 4.2 Video Grid & Tiles (`VideoGrid.tsx`, `VideoTile.tsx`)
- **Grid Modes**:
  - `1 Participant`: Full-width featured presentation card.
  - `2 Participants`: 50/50 split.
  - `3 Participants`: 2 top, 1 centered bottom.
  - `4 Participants`: 2x2 grid.
  - `5–6 Participants`: 3x2 balanced grid.
- **Presentation Stage Mode**:
  - When screen share is active, screen content occupies the primary stage (`video-stage-viewport`), while all participant cameras remain live in an unobtrusive bottom strip (`video-stage-strip`).
- **Speaking Indicator**:
  - Replaces all blurry green neon glow with a clean 2px Electric Mint ring: `box-shadow: 0 0 0 2px var(--accent)`.
- **Overlays**:
  - Participant name tag rendered in Level 1 graphite (`rgba(14, 18, 27, 0.82)`) with `var(--radius-xs)` and subtle border.

### 4.3 Stage Broadcasts (`StageRoom.tsx`)
- Broadcast mode separating speakers from listeners:
  - Speakers grid with live video or high-res avatar, speaking indicator, and dynamic audio level bars.
  - Quiet audience chip grid with raised-hand queue for moderator approval.
  - Dedicated stage bottom bar with "Request to Speak" / "Step Down" actions.

---

## 5. Messaging, Forums & Content Architecture

### 5.1 Chat Viewport & Message Composer (`ChatContainer.tsx`, `MessageComposer.tsx`, `MessageItem.tsx`)
- **Pinned Messages Banner**: Discreet amber-tinted banner at top of chat pane with instant jump-to-message capability.
- **Message Grouping**: Messages from the same author within 5 minutes omit the avatar and display grouped timestamps on hover (`padding-left: 58px`).
- **Rich Code Blocks**: Rendered in `JetBrains Mono` over Level 0 Obsidian (`var(--bg-app)`) with syntax highlight readiness.
- **Composer**: Solid graphite container (`#181D28`), Electric Mint send button (`#10E7B2` background with `#0A0C10` icon for optimal contrast).
- **Reaction Pills**: Minimalist chips with subtle surface backgrounds; highlighted with `var(--accent-subtle)` and `var(--accent)` border when reacted by the current user.

### 5.2 Forums & Topics (`ForumContainer.tsx`)
- Architectural card grid for community questions, guides, and asynchronous discussions.
- Filter chips with `var(--radius-xs)` and Electric Mint active state.
- Post cards displaying author, reply count, tag chips, and emerald `SOLVED` status badge.
- Thread view with full original post, reply stream, and quick constructive reply form.

### 5.3 Saved Messages Drawer (`SavedMessagesDrawer.tsx`)
- Slide-over drawer on the right side (`360px width`).
- Quick bookmark access: star any message to save for later review.
- Jump to channel and message action button (`ArrowUpRight`).

---

## 6. Modals, Search & Dialogs

### 6.1 Command Palette (`CommandPalette.tsx`)
- Triggered by `Ctrl+K` or `Cmd+K`.
- Level 4 Mineral Graphite surface with subtle border and backdrop blur.
- Instant search across workspaces, channels, voice actions, and settings.
- Keyboard navigation (Arrow Up/Down, Enter, Esc).

### 6.2 Global Search (`GlobalSearchModal.tsx`)
- Cross-channel message search with `from:username` and `in:channel` filter syntax.
- Direct jump to historical messages.

### 6.3 Settings & Diagnostics (`SettingsModal.tsx`, `DiagnosticsModal.tsx`)
- **Account Settings**: Display name, username, bio, and avatar configuration.
- **Audio & Video DSP**: Input gain, output volume, hardware test chime, and toggles for echo cancellation, noise suppression, and auto gain control.
- **Appearance Themes**: "Mineral Obsidian (Default)" and "Mineral Slate".
- **Observability**: Live WebRTC telemetry metrics (RTT, packet loss, jitter, bitrate, resolution, FPS, codecs).

---

## 7. Motion & Accessibility

### 7.1 Motion Design Principles
- **Subtle & Purposeful**: Animations must never delay user actions. Durations stay between `120ms` and `180ms`.
- **Easings**: `cubic-bezier(0.16, 1, 0.3, 1)` for modals and menus; `ease-out` for hover states.
- **Reduced Motion**: Full compliance with `prefers-reduced-motion: reduce`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

### 7.2 Accessibility & Contrast
- Minimum text contrast ratio of `4.5:1` for normal body text and `7:1` for small UI text against Mineral Graphite surfaces.
- Active Electric Mint CTAs use `#0A0C10` icon/text to ensure a high contrast ratio exceeding `12:1`.
- Clean focus ring (`0 0 0 2px var(--accent)`) on all interactive inputs, buttons, and keyboard-focusable elements.

---

## 8. Implementation Roadmap & Phases

```text
Phase 1: Tokens, Color System & Typography ── [COMPLETED]
Phase 2: Navigation Shell & Surface Hierarchy ─ [COMPLETED]
Phase 3: Floating Video Controls & Tile Presentation [COMPLETED]
Phase 4: Stage Broadcasts, Forums & Messaging [COMPLETED]
Phase 5: Modals, Drawers & System Dialogs ──── [COMPLETED]
Phase 6: Continuous Validation & Design Hardening [COMPLETED]
```

### Phase Details:
1. **Phase 1 (Foundations)**: `tokens.css`, `global.css`, `index.html`, `favicon.svg` brandmark.
2. **Phase 2 (Shell)**: `ServerSidebar.tsx`, `ChannelSidebar.tsx`, `TopAppBar.tsx`, `UserBar.tsx`, `MemberList.tsx`, `layout.css`.
3. **Phase 3 (Video & Media)**: `VideoControls.tsx`, `VideoTile.tsx`, `VideoGrid.tsx`, `VideoRoom.tsx`, `PreJoinModal.tsx`.
4. **Phase 4 (Collaboration)**: `ChatContainer.tsx`, `MessageComposer.tsx`, `MessageItem.tsx`, `ForumContainer.tsx`, `StageRoom.tsx`.
5. **Phase 5 (System Services)**: `CommandPalette.tsx`, `GlobalSearchModal.tsx`, `SavedMessagesDrawer.tsx`, `SettingsModal.tsx`, `AuditLogModal.tsx`, `AuthModal.tsx`.
6. **Phase 6 (Verification)**: Full TypeScript build validation (`npm run build`), legacy hex audit, and token fidelity checks.
