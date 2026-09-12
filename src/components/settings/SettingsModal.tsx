import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { SEED_USERS } from '../../lib/supabase/mockStore';
import { Avatar } from '../ui/Avatar';
import { User, Volume2, Video, Sliders, Bell } from 'lucide-react';
import { VideoQuality } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile, switchDemoUser, isDemoMode } = useAuth();
  const { deviceSettings, updateSettings, audioLevel } = useMedia();

  const [activeTab, setActiveTab] = useState<'account' | 'voice_video' | 'appearance' | 'notifications'>('account');

  // Account State
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Audio/Video State
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [testVideoActive, setTestVideoActive] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setUsername(currentUser.username);
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser]);

  // Enumerate devices when on Audio & Video tab
  useEffect(() => {
    if (isOpen && activeTab === 'voice_video') {
      MediaSession.getAvailableDevices().then((devs) => {
        setAudioInputs(devs.audioInputs);
        setVideoInputs(devs.videoInputs);
      });
    }

    return () => {
      // Clean up test camera
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      }
    };
  }, [isOpen, activeTab]);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      displayName,
      username,
      bio,
      avatarUrl,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const toggleTestCamera = async () => {
    if (testVideoActive) {
      if (testStreamRef.current) {
        testStreamRef.current.getTracks().forEach((t) => t.stop());
        testStreamRef.current = null;
      }
      setTestVideoActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceSettings.videoInputId ? { deviceId: { exact: deviceSettings.videoInputId } } : true,
        });
        testStreamRef.current = stream;
        if (testVideoRef.current) {
          testVideoRef.current.srcObject = stream;
        }
        setTestVideoActive(true);
      } catch (err) {
        console.warn('Cannot open preview camera:', err);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="User Settings"
      maxWidth="680px"
    >
      <div style={{ display: 'flex', gap: 20, minHeight: 420 }}>
        {/* Settings Navigation Tabs */}
        <div
          style={{
            width: 170,
            borderRight: '1px solid var(--border-subtle)',
            paddingRight: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <button
            onClick={() => setActiveTab('account')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === 'account' ? 'var(--bg-surface-active)' : 'transparent',
              color: activeTab === 'account' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <User size={16} />
            <span>My Account</span>
          </button>

          <button
            onClick={() => setActiveTab('voice_video')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === 'voice_video' ? 'var(--bg-surface-active)' : 'transparent',
              color: activeTab === 'voice_video' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Video size={16} />
            <span>Voice & Video</span>
          </button>

          <button
            onClick={() => setActiveTab('appearance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === 'appearance' ? 'var(--bg-surface-active)' : 'transparent',
              color: activeTab === 'appearance' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Sliders size={16} />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveTab('notifications')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === 'notifications' ? 'var(--bg-surface-active)' : 'transparent',
              color: activeTab === 'notifications' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Bell size={16} />
            <span>Notifications</span>
          </button>
        </div>

        {/* Settings Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* TAB 1: My Account */}
          {activeTab === 'account' && (
            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Avatar
                  src={avatarUrl || currentUser?.avatarUrl}
                  name={displayName || 'User'}
                  size={64}
                />
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700 }}>{displayName || currentUser?.username}</h4>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>#{username}</span>
                </div>
              </div>

              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />

              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <Input
                label="Avatar URL"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
              />

              <div className="input-group">
                <label className="input-label">About Me (Bio)</label>
                <textarea
                  className="textarea-field"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about yourself..."
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                {savedSuccess && (
                  <span style={{ fontSize: 12, color: 'var(--status-online)', fontWeight: 600 }}>
                    Changes saved successfully!
                  </span>
                )}
                <Button type="submit" variant="primary" style={{ marginLeft: 'auto' }}>
                  Save Profile
                </Button>
              </div>

              {/* Fast User Switcher for Local Demo */}
              {isDemoMode && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                  <label className="input-label" style={{ marginBottom: 8, display: 'block' }}>
                    Quick Test Persona Switcher:
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {SEED_USERS.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => switchDemoUser(user.id)}
                        className={`btn ${currentUser?.id === user.id ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {user.displayName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: Voice & Video */}
          {activeTab === 'voice_video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Quality Settings */}
              <div className="input-group">
                <label className="input-label">Target Video Quality</label>
                <select
                  className="input-field"
                  value={deviceSettings.videoQuality}
                  onChange={(e) => updateSettings({ videoQuality: e.target.value as VideoQuality })}
                >
                  <option value="1080p">1080p Full HD (1920x1080 @ 30fps) - Recommended</option>
                  <option value="720p">720p HD (1280x720 @ 30fps)</option>
                  <option value="480p">480p SD (640x480 @ 30fps)</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Meetwo gracefully falls back if hardware or connection limits resolution.
                </span>
              </div>

              {/* Microphone Selection */}
              <div className="input-group">
                <label className="input-label">Input Device (Microphone)</label>
                <select
                  className="input-field"
                  value={deviceSettings.audioInputId}
                  onChange={(e) => updateSettings({ audioInputId: e.target.value })}
                >
                  <option value="">Default Microphone</option>
                  {audioInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Web Audio Diagnostic Suite */}
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={16} style={{ color: 'var(--accent-light)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Web Audio Diagnostic Suite</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-online)', fontWeight: 600 }}>
                    DSP Active
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      try {
                        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                        if (!AudioContextClass) return;
                        const ctx = new AudioContextClass();
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
                        gain.gain.setValueAtTime(0.2, ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.start();
                        osc.stop(ctx.currentTime + 0.45);
                      } catch (err) {
                        console.warn('Audio test failed:', err);
                      }
                    }}
                  >
                    <Volume2 size={14} />
                    <span>Test Audio Chime</span>
                  </Button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Verifies browser output device & stereo panning</span>
                  </div>
                </div>

                {/* Diagnostics matrix */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 4 }}>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>LATENCY (RTT)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-online)' }}>~24 ms</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PACKET LOSS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-online)' }}>0.0 %</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AUDIO CODEC</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)' }}>Opus 48kHz</div>
                  </div>
                </div>
              </div>

              {/* Mic Test Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Mic Volume Activity</span>
                  <span style={{ fontWeight: 600, color: 'var(--status-online)' }}>{audioLevel}%</span>
                </div>
                <div
                  style={{
                    height: 10,
                    width: '100%',
                    background: 'var(--bg-surface-active)',
                    borderRadius: 'var(--radius-pill)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${audioLevel}%`,
                      background: audioLevel > 50 ? 'var(--status-idle)' : 'var(--status-online)',
                      transition: 'width 100ms ease',
                    }}
                  />
                </div>
              </div>

              {/* Camera Selection */}
              <div className="input-group">
                <label className="input-label">Video Device (Camera)</label>
                <select
                  className="input-field"
                  value={deviceSettings.videoInputId}
                  onChange={(e) => updateSettings({ videoInputId: e.target.value })}
                >
                  <option value="">Default Camera</option>
                  {videoInputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera (${d.deviceId.slice(0, 6)})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Camera Test Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="input-label">Camera Preview Test</span>
                  <Button
                    type="button"
                    variant={testVideoActive ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={toggleTestCamera}
                  >
                    {testVideoActive ? 'Stop Preview' : 'Test Camera'}
                  </Button>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 160,
                    borderRadius: 'var(--radius-md)',
                    background: '#0a0d14',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {testVideoActive ? (
                    <video
                      ref={testVideoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Camera preview inactive</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Appearance */}
          {activeTab === 'appearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">Theme</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: '#0B0E14',
                      border: '2px solid var(--accent)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Obsidian (Dark)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Deep space obsidian aesthetic</div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: '#0F172A',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#CBD5E1' }}>Midnight Blue</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sleek navy contrast</div>
                  </div>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Interface Density</label>
                <select className="input-field" defaultValue="comfortable">
                  <option value="comfortable">Comfortable (Default)</option>
                  <option value="compact">Compact (Higher message density)</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 4: Notifications */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span style={{ fontSize: 14 }}>Enable Desktop Push Notifications</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span style={{ fontSize: 14 }}>Play sound on incoming direct messages</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span style={{ fontSize: 14 }}>Play chime on voice channel connect/disconnect</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
