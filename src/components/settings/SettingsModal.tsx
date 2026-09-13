import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';
import { MediaSession } from '../../lib/webrtc/mediaSession';
import { playSpeakerTestChime } from '../../lib/webrtc/audioProcessing';
import { Avatar } from '../ui/Avatar';
import { User, Volume2, Video, Sliders, Bell, Sparkles, CheckCircle2 } from 'lucide-react';
import { VideoQuality, QualityMode } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, updateProfile, switchDemoUser, isDemoMode } = useAuth();
  const {
    activeRoomId,
    deviceSettings,
    updateSettings,
    audioLevel,
    isSpeaking,
    gateState,
    connectionStats,
    isAudioMuted,
    isVideoMuted,
    switchCamera,
    switchMicrophone,
  } = useMedia();

  const [activeTab, setActiveTab] = useState<'account' | 'voice_video' | 'appearance' | 'notifications'>('account');

  // Account State
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Audio/Video State
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [testVideoActive, setTestVideoActive] = useState(false);
  const [isChimePlaying, setIsChimePlaying] = useState(false);
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
        setAudioOutputs(devs.audioOutputs);
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
            </form>
          )}

          {/* TAB 2: Voice & Video (Meetwo V3 Quality-First) */}
          {activeTab === 'voice_video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Quality Preset & Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Target Video Quality</label>
                  <select
                    className="input-field"
                    value={deviceSettings.videoQuality}
                    onChange={(e) => updateSettings({ videoQuality: e.target.value as VideoQuality })}
                  >
                    <option value="4K">4K Ultra HD (3840x2160 @ 30fps)</option>
                    <option value="1440p">1440p Quad HD (2560x1440 @ 30fps)</option>
                    <option value="1080p">1080p Full HD (1920x1080 @ 60fps)</option>
                    <option value="720p">720p HD (1280x720 @ 60fps)</option>
                    <option value="480p">480p SD (640x480 @ 30fps)</option>
                    <option value="360p">360p Mobile (480x360 @ 24fps)</option>
                  </select>
                </div>

                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Quality Mode</label>
                  <select
                    className="input-field"
                    value={deviceSettings.qualityMode}
                    onChange={(e) => updateSettings({ qualityMode: e.target.value as QualityMode })}
                  >
                    <option value="ultra">Ultra (Maximum Bitrate & Quality Lock)</option>
                    <option value="auto">Auto (Best Dynamic Adaptation)</option>
                    <option value="high">High Quality (Prioritize 1080p+)</option>
                    <option value="balanced">Balanced (Stable Bandwidth)</option>
                    <option value="low_bandwidth">Low Bandwidth (Audio First)</option>
                  </select>
                </div>
              </div>

              {/* Hardware Selection: Mic & Speaker */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Microphone Selection */}
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Input Device (Microphone)</label>
                  <select
                    className="input-field"
                    value={deviceSettings.audioInputId}
                    onChange={(e) => {
                      updateSettings({ audioInputId: e.target.value });
                      switchMicrophone(e.target.value);
                    }}
                  >
                    <option value="">Default Microphone</option>
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone (${d.deviceId.slice(0, 6)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speaker Output Selection */}
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label">Output Device (Speakers / Headphones)</label>
                  <select
                    className="input-field"
                    value={deviceSettings.audioOutputId}
                    onChange={(e) => updateSettings({ audioOutputId: e.target.value })}
                  >
                    <option value="">Default Speakers / Headphones</option>
                    {audioOutputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Speaker (${d.deviceId.slice(0, 6)})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Volume Sliders Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Input Volume */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Input Volume (Gain)</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {deviceSettings.inputVolume || 100}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={deviceSettings.inputVolume || 100}
                    onChange={(e) => updateSettings({ inputVolume: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>

                {/* Output Volume */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Output Volume</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {deviceSettings.outputVolume || 100}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={deviceSettings.outputVolume || 100}
                    onChange={(e) => updateSettings({ outputVolume: parseInt(e.target.value, 10) })}
                    style={{ width: '100%', accentColor: 'var(--accent)' }}
                  />
                </div>
              </div>

              {/* Mic Volume Activity Meter with Gate Status */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={16} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Audio Hardware Test & Telemetry</span>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      setIsChimePlaying(true);
                      await playSpeakerTestChime(deviceSettings.audioOutputId, deviceSettings.outputVolume);
                      setIsChimePlaying(false);
                    }}
                    disabled={isChimePlaying}
                  >
                    <Volume2 size={14} />
                    <span>{isChimePlaying ? 'Playing chime...' : 'Test Speaker Chime'}</span>
                  </Button>
                </div>

                {/* Mic Volume Activity Meter & Gate Indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Live Mic Activity</span>
                      {deviceSettings.noiseGate && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            background: gateState === 'open' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: gateState === 'open' ? 'var(--status-online)' : 'var(--warning)',
                            border: `1px solid ${gateState === 'open' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {gateState === 'open' ? '● Gate: Open' : '✦ Gate: Muffled'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-surface-active)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {deviceSettings.audioCompressionProfile === 'high_compression'
                          ? 'Opus 64kbps Voice • DTX'
                          : deviceSettings.audioCompressionProfile === 'studio_hd'
                          ? 'Opus 510kbps Stereo • Fullband'
                          : 'Opus 320kbps Studio • RED'}
                      </span>
                      <span style={{ fontWeight: 600, color: audioLevel > 15 ? 'var(--status-online)' : 'var(--text-muted)' }}>
                        {audioLevel}%
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 8,
                      width: '100%',
                      background: 'var(--bg-surface-active)',
                      borderRadius: 'var(--radius-xs)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${audioLevel}%`,
                        background: audioLevel > 50 ? 'var(--warning)' : 'var(--accent)',
                        transition: 'width 80ms ease',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Voice Processing & Isolation Studio Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="input-label" style={{ marginBottom: 0 }}>Active Voice Processing & Isolation</span>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Zero-Latency DSP</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.echoCancellation ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.echoCancellation ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.echoCancellation}
                        onChange={(e) => updateSettings({ echoCancellation: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Echo Cancellation</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      AEC feedback prevention
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.noiseSuppression ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.noiseSuppression ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.noiseSuppression}
                        onChange={(e) => updateSettings({ noiseSuppression: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Noise Suppression</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      Spectral noise subtraction
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.autoGainControl ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.autoGainControl ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.autoGainControl}
                        onChange={(e) => updateSettings({ autoGainControl: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Auto Gain Control</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      Automatic hardware leveling
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.voiceIsolation ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.voiceIsolation ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.voiceIsolation}
                        onChange={(e) => updateSettings({ voiceIsolation: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Voice Isolation</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      2.8 kHz formant boost
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.noiseGate ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.noiseGate ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.noiseGate}
                        onChange={(e) => updateSettings({ noiseGate: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Adaptive Noise Gate</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      Downward expander on pauses
                    </span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.dynamicsCompressor ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.dynamicsCompressor ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.dynamicsCompressor}
                        onChange={(e) => updateSettings({ dynamicsCompressor: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>Studio Compressor</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      Broadcast soft-knee leveling
                    </span>
                  </label>
                </div>

                {/* Sub-row: Noise Gate Mode & Rumble Filter */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      padding: '8px 10px',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 600 }}>Noise Gate Sensitivity</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {deviceSettings.noiseGateMode === 'aggressive'
                          ? '-40 dB (Deep)'
                          : deviceSettings.noiseGateMode === 'gentle'
                          ? '-20 dB (Soft)'
                          : '-30 dB (Balanced)'}
                      </span>
                    </div>
                    <select
                      className="input"
                      value={deviceSettings.noiseGateMode || 'balanced'}
                      onChange={(e) => updateSettings({ noiseGateMode: e.target.value as any })}
                      disabled={!deviceSettings.noiseGate}
                      style={{ height: 28, fontSize: 11, padding: '2px 8px' }}
                    >
                      <option value="gentle">Gentle (-20 dB) - For quiet rooms</option>
                      <option value="balanced">Balanced (-30 dB) - Recommended</option>
                      <option value="aggressive">Aggressive (-40 dB) - Deep silence</option>
                    </select>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '8px 10px',
                      background: deviceSettings.highPassFilter ? 'var(--bg-surface-active)' : 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${deviceSettings.highPassFilter ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={deviceSettings.highPassFilter}
                        onChange={(e) => updateSettings({ highPassFilter: e.target.checked })}
                      />
                      <span style={{ fontWeight: 600 }}>85Hz Rumble Highpass</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 22 }}>
                      Eliminates desk thuds & AC hum
                    </span>
                  </label>
                </div>
              </div>

              {/* Audio Compression & Codec Profile Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="input-label" style={{ marginBottom: 0 }}>
                    Audio Compression & Bitrate (Opus Codec)
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    In-Band FEC • DTX Silence Suppression
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => updateSettings({ audioCompressionProfile: 'balanced', stereoAudio: true })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      background:
                        deviceSettings.audioCompressionProfile === 'balanced'
                          ? 'var(--bg-surface-active)'
                          : 'var(--bg-surface)',
                      border: `1px solid ${
                        deviceSettings.audioCompressionProfile === 'balanced'
                          ? 'var(--accent)'
                          : 'var(--border-subtle)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Balanced Voice</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: 'var(--accent)',
                        }}
                      >
                        DEFAULT
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>320 kbps Studio Opus</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      Pristine broadcast fidelity with RED packet-loss immunity
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ audioCompressionProfile: 'high_compression', stereoAudio: false })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      background:
                        deviceSettings.audioCompressionProfile === 'high_compression'
                          ? 'var(--bg-surface-active)'
                          : 'var(--bg-surface)',
                      border: `1px solid ${
                        deviceSettings.audioCompressionProfile === 'high_compression'
                          ? 'var(--accent)'
                          : 'var(--border-subtle)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>High Compression</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: 'var(--status-online)',
                        }}
                      >
                        SAVER
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--status-online)' }}>64 kbps Opus + DTX</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      Optimized low-bandwidth speech for mobile & slow connections
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ audioCompressionProfile: 'studio_hd', stereoAudio: true })}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      padding: '10px 12px',
                      background:
                        deviceSettings.audioCompressionProfile === 'studio_hd'
                          ? 'var(--bg-surface-active)'
                          : 'var(--bg-surface)',
                      border: `1px solid ${
                        deviceSettings.audioCompressionProfile === 'studio_hd'
                          ? 'var(--accent)'
                          : 'var(--border-subtle)'
                      }`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Studio HD</span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(168, 85, 247, 0.15)',
                          color: '#c084fc',
                        }}
                      >
                        HI-FI
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#c084fc' }}>510 kbps Fullband Stereo</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                      Maximum dynamic range and uncompromised acoustic fidelity
                    </span>
                  </button>
                </div>
              </div>

              {/* Real Active WebRTC Diagnostics (Truthful Reporting) */}
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    MEDIA DIAGNOSTICS & TELEMETRY
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      background: activeRoomId ? 'var(--accent-subtle)' : 'var(--bg-surface-active)',
                      color: activeRoomId ? 'var(--accent)' : 'var(--text-muted)',
                      border: activeRoomId ? '1px solid rgba(16, 231, 178, 0.25)' : '1px solid var(--border-subtle)',
                      fontWeight: 600,
                    }}
                  >
                    {activeRoomId ? connectionStats.quality.toUpperCase() : 'NOT IN CALL'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>LATENCY (RTT)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: connectionStats.rtt !== undefined ? 'var(--status-online)' : 'var(--text-muted)' }}>
                      {connectionStats.rtt !== undefined ? `${connectionStats.rtt} ms` : '--'}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PACKET LOSS</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: connectionStats.packetLoss !== undefined ? 'var(--status-online)' : 'var(--text-muted)' }}>
                      {connectionStats.packetLoss !== undefined ? `${connectionStats.packetLoss}%` : '--'}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>JITTER</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: connectionStats.jitter !== undefined ? 'var(--status-online)' : 'var(--text-muted)' }}>
                      {connectionStats.jitter !== undefined ? `${connectionStats.jitter} ms` : '--'}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BITRATE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: connectionStats.bitrate !== undefined ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {connectionStats.bitrate !== undefined
                        ? connectionStats.bitrate >= 1000
                          ? `${(connectionStats.bitrate / 1000).toFixed(1)} Mbps`
                          : `${connectionStats.bitrate} kbps`
                        : '0 kbps'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>RESOLUTION</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: connectionStats.resolution ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {connectionStats.resolution || (isVideoMuted ? 'Camera Off' : 'Unavailable')}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>FRAME RATE</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: connectionStats.fps !== undefined ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {connectionStats.fps !== undefined ? `${connectionStats.fps} fps` : (isVideoMuted ? '--' : 'Unavailable')}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AUDIO CODEC</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: connectionStats.audioCodec ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {connectionStats.audioCodec || (isAudioMuted ? 'Muted' : 'Opus 48kHz')}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-surface-active)', padding: '8px 10px', borderRadius: 'var(--radius-xs)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>VIDEO CODEC</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: connectionStats.videoCodec ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {connectionStats.videoCodec || (isVideoMuted ? '--' : 'VP8 / H.264')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Camera Selection & Preview */}
              <div className="input-group">
                <label className="input-label">Video Device (Camera)</label>
                <select
                  className="input-field"
                  value={deviceSettings.videoInputId}
                  onChange={(e) => {
                    updateSettings({ videoInputId: e.target.value });
                    switchCamera(e.target.value);
                  }}
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
                    background: 'var(--bg-app)',
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
                      background: 'var(--bg-main)',
                      border: '2px solid var(--accent)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Mineral Obsidian (Default)</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Quiet, architectural dark space</div>
                  </div>
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)' }}>Mineral Slate</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subtle graphite tone</div>
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
