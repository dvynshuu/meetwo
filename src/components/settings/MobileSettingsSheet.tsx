import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useAuth } from '../../app/providers/AuthContext';
import { useMedia } from '../../app/providers/MediaContext';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  User,
  Volume2,
  Video,
  Bell,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Check,
  Moon,
  Sun,
  Camera,
  Mic,
} from 'lucide-react';
import { VideoQuality, QualityMode } from '../../types';

interface MobileSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'main' | 'account' | 'voice_video' | 'appearance' | 'notifications';

export const MobileSettingsSheet: React.FC<MobileSettingsSheetProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, updateProfile, isDemoMode, logout } = useAuth();
  const { deviceSettings, updateSettings } = useMedia();

  const [activeSection, setActiveSection] = useState<SettingsSection>('main');

  // Account form state
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !username.trim()) return;
    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'account':
        return 'Account & Profile';
      case 'voice_video':
        return 'Audio & Video';
      case 'appearance':
        return 'Appearance';
      case 'notifications':
        return 'Notifications';
      default:
        return 'Settings';
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="mobile-settings-header-title">
          {activeSection !== 'main' && (
            <button
              type="button"
              className="mobile-settings-back-btn"
              onClick={() => setActiveSection('main')}
              aria-label="Back to Settings"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span>{getSectionTitle()}</span>
        </div>
      }
      maxHeight="88vh"
    >
      <div className="mobile-settings-content">
        {/* SECTION: MAIN LIST */}
        {activeSection === 'main' && (
          <div className="mobile-settings-menu">
            {/* User Profile Card */}
            <div
              className="mobile-settings-profile-card"
              onClick={() => setActiveSection('account')}
              role="button"
            >
              <Avatar
                src={currentUser?.avatarUrl}
                name={currentUser?.displayName || currentUser?.username || 'User'}
                size={54}
                status={currentUser?.status}
                showStatus={true}
              />
              <div className="mobile-settings-profile-info">
                <span className="name">{currentUser?.displayName || currentUser?.username}</span>
                <span className="handle">@{currentUser?.username}</span>
                {currentUser?.bio && <span className="bio truncate">{currentUser.bio}</span>}
              </div>
              <ChevronRight size={18} className="chevron" />
            </div>

            <div className="mobile-settings-group">
              <div
                className="mobile-settings-row"
                onClick={() => setActiveSection('account')}
                role="button"
              >
                <div className="icon-wrap">
                  <User size={18} />
                </div>
                <span className="label">Account & Profile</span>
                <ChevronRight size={18} className="chevron" />
              </div>

              <div
                className="mobile-settings-row"
                onClick={() => setActiveSection('voice_video')}
                role="button"
              >
                <div className="icon-wrap">
                  <Video size={18} />
                </div>
                <span className="label">Voice & Video Quality</span>
                <ChevronRight size={18} className="chevron" />
              </div>

              <div
                className="mobile-settings-row"
                onClick={() => setActiveSection('notifications')}
                role="button"
              >
                <div className="icon-wrap">
                  <Bell size={18} />
                </div>
                <span className="label">Notifications & Sounds</span>
                <ChevronRight size={18} className="chevron" />
              </div>

              <div
                className="mobile-settings-row"
                onClick={() => setActiveSection('appearance')}
                role="button"
              >
                <div className="icon-wrap">
                  <Sparkles size={18} />
                </div>
                <span className="label">Appearance & Theme</span>
                <ChevronRight size={18} className="chevron" />
              </div>
            </div>

            {/* Logout Action */}
            <div className="mobile-settings-group">
              <div
                className="mobile-settings-row danger"
                onClick={() => {
                  onClose();
                  logout?.();
                }}
                role="button"
              >
                <div className="icon-wrap danger-icon">
                  <LogOut size={18} />
                </div>
                <span className="label">Log Out</span>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: ACCOUNT */}
        {activeSection === 'account' && (
          <form onSubmit={handleSaveAccount} className="mobile-settings-subform">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <Avatar
                src={avatarUrl || currentUser?.avatarUrl}
                name={displayName || 'User'}
                size={60}
              />
              <div>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{displayName}</h4>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{username}</span>
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
              placeholder="https://images.unsplash.com/..."
            />

            <div className="input-group">
              <label className="input-label">Bio</label>
              <textarea
                className="textarea-field"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="About you..."
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              {savedSuccess && (
                <span style={{ fontSize: 13, color: 'var(--status-online)', fontWeight: 600 }}>
                  Saved!
                </span>
              )}
              <Button type="submit" variant="primary" style={{ marginLeft: 'auto', minHeight: 44 }}>
                Save Profile
              </Button>
            </div>
          </form>
        )}

        {/* SUBSECTION: VOICE & VIDEO */}
        {activeSection === 'voice_video' && (
          <div className="mobile-settings-subform">
            <div className="input-group">
              <label className="input-label">Video Stream Quality</label>
              <select
                className="input-field"
                value={deviceSettings.videoQuality}
                onChange={(e) => updateSettings({ videoQuality: e.target.value as VideoQuality })}
                style={{ height: 44 }}
              >
                <option value="1080p">1080p Full HD (WiFi recommended)</option>
                <option value="720p">720p HD (Balanced mobile default)</option>
                <option value="480p">480p SD (Data Saver 4G/LTE)</option>
                <option value="360p">360p Low Bandwidth</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Quality Optimization Mode</label>
              <select
                className="input-field"
                value={deviceSettings.qualityMode}
                onChange={(e) => updateSettings({ qualityMode: e.target.value as QualityMode })}
                style={{ height: 44 }}
              >
                <option value="adaptive">Adaptive Dynacast (Battery & data smart)</option>
                <option value="favor-detail">Detail First (Sharp text & screen)</option>
                <option value="favor-motion">Fluid Motion (High 60fps)</option>
              </select>
            </div>

            <div className="mobile-toggle-card">
              <div>
                <span className="toggle-title">Acoustic Echo Cancellation</span>
                <span className="toggle-sub">Prevents speaker feedback on mobile devices</span>
              </div>
              <input
                type="checkbox"
                checked={deviceSettings.echoCancellation}
                onChange={(e) => updateSettings({ echoCancellation: e.target.checked })}
                style={{ width: 20, height: 20 }}
              />
            </div>

            <div className="mobile-toggle-card">
              <div>
                <span className="toggle-title">Background Noise Suppression</span>
                <span className="toggle-sub">Reduces ambient wind, fan, and room noise</span>
              </div>
              <input
                type="checkbox"
                checked={deviceSettings.noiseSuppression}
                onChange={(e) => updateSettings({ noiseSuppression: e.target.checked })}
                style={{ width: 20, height: 20 }}
              />
            </div>
          </div>
        )}

        {/* SUBSECTION: NOTIFICATIONS */}
        {activeSection === 'notifications' && (
          <div className="mobile-settings-subform">
            <div className="mobile-toggle-card">
              <div>
                <span className="toggle-title">Direct Message Alerts</span>
                <span className="toggle-sub">Notify when you receive private messages</span>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 20, height: 20 }} />
            </div>

            <div className="mobile-toggle-card">
              <div>
                <span className="toggle-title">Mention Badges</span>
                <span className="toggle-sub">Highlight @mentions in channels</span>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 20, height: 20 }} />
            </div>

            <div className="mobile-toggle-card">
              <div>
                <span className="toggle-title">Call Ring Chimes</span>
                <span className="toggle-sub">Play audio chime when joining rooms</span>
              </div>
              <input type="checkbox" defaultChecked style={{ width: 20, height: 20 }} />
            </div>
          </div>
        )}

        {/* SUBSECTION: APPEARANCE */}
        {activeSection === 'appearance' && (
          <div className="mobile-settings-subform">
            <div className="theme-selection-grid">
              <div className="theme-option active">
                <Moon size={24} style={{ color: 'var(--accent)' }} />
                <span>Midnight Graphite</span>
                <Check size={16} className="theme-check" />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Meetwo is engineered with dark mineral graphite surfaces and electric mint accents for optimal OLED battery efficiency and low eye-strain.
            </p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
