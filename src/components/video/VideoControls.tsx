import React from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings, PhoneOff } from 'lucide-react';
import { useMedia } from '../../app/providers/MediaContext';

interface VideoControlsProps {
  onOpenSettings: () => void;
}

export const VideoControls: React.FC<VideoControlsProps> = ({ onOpenSettings }) => {
  const {
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveVoiceRoom,
  } = useMedia();

  return (
    <div className="video-controls-bar" id="video-controls">
      {/* Microphone */}
      <button
        className={`video-control-btn ${isAudioMuted ? 'active-off' : ''}`}
        onClick={toggleAudio}
        title={isAudioMuted ? 'Unmute (Ctrl+D)' : 'Mute (Ctrl+D)'}
        aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
      >
        {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      {/* Camera */}
      <button
        className={`video-control-btn ${isVideoMuted ? 'active-off' : ''}`}
        onClick={toggleVideo}
        title={isVideoMuted ? 'Turn On Camera (Ctrl+E)' : 'Turn Off Camera (Ctrl+E)'}
        aria-label={isVideoMuted ? 'Turn On Camera' : 'Turn Off Camera'}
      >
        {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
      </button>

      {/* Screen Share */}
      <button
        className={`video-control-btn ${isScreenSharing ? 'active-screen' : ''}`}
        onClick={toggleScreenShare}
        title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
        aria-label={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
      >
        <Monitor size={20} />
      </button>

      {/* Device Settings */}
      <button
        className="video-control-btn"
        onClick={onOpenSettings}
        title="Voice & Video Settings"
        aria-label="Settings"
      >
        <Settings size={20} />
      </button>

      {/* Leave Room */}
      <button
        className="video-control-btn leave-btn"
        onClick={() => leaveVoiceRoom()}
        title="Disconnect"
        aria-label="Disconnect"
      >
        <PhoneOff size={20} />
      </button>
    </div>
  );
};
