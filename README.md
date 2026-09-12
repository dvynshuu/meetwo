# Meetwo 🚀
### Next-Generation Realtime Communication & Community Platform

Meetwo is a modern, high-performance real-time communication platform built for communities, broadcasts, and developer collaboration. Inspired by modern collaboration tools like Discord, Slack, and Zoom, Meetwo delivers a sleek obsidian dark-mode interface, sub-second messaging, multi-peer WebRTC video, live broadcast stages, and forum topic discussions.

---

## 🌟 Key Features

### 🎙️ 1. Advanced Media Engine & Stage Broadcasts
- **Multi-Peer WebRTC Mesh & SFU Ready**: Supports Full HD 1080p/720p/480p dynamic video with automatic resolution downscaling.
- **Stage Broadcast Rooms**: Eliminates mesh scaling bottlenecks by separating **Stage Speakers** (active MediaStreams, audio visualizers, host badges) from **Audience Listeners** (low-overhead attendees).
- **Interactive Hand-Raising Queue**: Listeners can "Request to Speak"; hosts and speakers receive live alerts with an approval queue to invite attendees to stage or dismiss requests.
- **Glare-Free Perfect Negotiation**: Deterministic polite/impolite peer signaling preventing race conditions during simultaneous connections.
- **Web Audio API Diagnostic Suite**: Integrated harmonic two-tone oscillator test chime (523Hz → 880Hz) to test output devices and stereo panning without requiring a remote peer.
- **Screen Share Stage Mode**: Automatic screen share spotlight with PiP (Picture-in-Picture) and fullscreen modes.

### 📁 2. Channel Hierarchy & Collapsible Categories
- **Collapsible Server Categories**: Organize channels into *Information & Chat*, *Voice & Hangouts*, *Live Stages & Broadcasts*, and *Community Discussions* with accordion chevron controls.
- **Rich Channel Types**:
  - `#` **Text Channels**: Real-time chat, code snippets, and attachments.
  - `🔊` **Voice & Video**: Low-latency mesh/SFU voice rooms.
  - `📻` **Stage Broadcasts**: Keynotes and AMAs with speaker/listener roles.
  - `💬` **Forum Discussions**: Persistent discussion topics with tags and solution markers.
  - `📢` **Announcements**: Broadcast channels for official server notices.

### 💬 3. Advanced Messaging & Collaboration
- **⭐ Saved Messages Drawer**: Bookmark messages with a single click and access them across all channels in a dedicated slide-over drawer with one-click jump-to-message navigation.
- **Dedicated Thread Drawers**: Branch complex conversations off parent messages into side-by-side threads to keep main channels clean.
- **Pinned Message Banners**: Pinned notices render at the top of channels with direct jump navigation.
- **Rich Interactive Actions**: Real-time reactions, quoted replies, inline editing (`Enter` to save, `Esc` to cancel), and one-click copy.
- **Markdown & Syntax Highlighting**: Automatic formatting for code blocks, inline code, URLs, and `@mentions`.

### ⚡ 4. Productivity & Observability
- **Global Command Palette (`Ctrl+K` / `Cmd+K`)**: Instant fuzzy search across all channels, servers, and system actions with arrow-key navigation.
- **Global Contextual Search**: Full-text message indexing with `from:` and `in:` filter parameters.
- **Server Governance Audit Logs**: Administrative activity audit logs tracking channel creation, role changes, and pinned messages.
- **Timed Custom Status**: Set custom status text and emojis with timed expiration (*Don't clear*, *30m*, *1h*, *4h*, *Today*).
- **Live Telemetry & Health Indicator**: Real-time top bar pill displaying Round-Trip Time (`24ms RTT`), packet loss, signaling status, and Web Audio DSP health.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS Design Tokens (Obsidian Dark Mode, Glassmorphism, Zero CSS framework bloat)
- **Icons**: Lucide React
- **Real-Time & Storage**: Supabase (PostgreSQL with Row Level Security & Realtime) + Built-in resilient MockStore demo layer
- **Media**: WebRTC (Native RTCPeerConnection), Web Audio API (Oscillators, GainNodes, AnalyserNodes)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `pnpm`

### Installation

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

## ⚙️ Configuration (Optional Supabase Backend)

By default, Meetwo runs seamlessly in **Demo Mode** with seeded users, servers, channels, and simulated real-time multi-tab events.

To connect a live Supabase project:
1. Create a `.env` file based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Apply the schema in `supabase/schema.sql` to your Supabase SQL editor.

---

## 📄 License

MIT License. Feel free to use and build upon this codebase.
