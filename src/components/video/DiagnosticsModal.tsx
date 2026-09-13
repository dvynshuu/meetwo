import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useMedia } from '../../app/providers/MediaContext';
import { logger, ObservabilityLogEntry } from '../../lib/webrtc/observability';
import { MeetwoTestHarness, TestResult } from '../../lib/webrtc/testHarness';
import {
  Activity,
  Terminal,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Radio,
  Wifi,
  Trash2,
} from 'lucide-react';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const {
    activeRoomId,
    connectionState,
    connectionStats,
    participants,
    localStream,
    screenStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    deviceSettings,
  } = useMedia();

  const [activeTab, setActiveTab] = useState<'metrics' | 'logs' | 'tests'>('metrics');
  const [logs, setLogs] = useState<ObservabilityLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<string>('all');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Synchronize logs on open and subscribe to new events
  useEffect(() => {
    if (isOpen) {
      setLogs(logger.getRecentLogs());
      const unsub = logger.subscribe((newEntry) => {
        setLogs((prev) => [...prev.slice(-149), newEntry]);
      });
      return () => unsub();
    }
  }, [isOpen]);

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const results = await MeetwoTestHarness.runAllTests();
      setTestResults(results);
    } catch (err) {
      console.error('Failed to run test harness:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleExportJSON = () => {
    const dump = {
      exportTimestamp: new Date().toISOString(),
      activeRoomId,
      connectionState,
      connectionStats,
      deviceSettings,
      localParticipant: {
        audioTracks: localStream?.getAudioTracks().map((t) => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })) || [],
        videoTracks: localStream?.getVideoTracks().map((t) => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })) || [],
        screenTracks: screenStream?.getTracks().map((t) => ({ id: t.id, kind: t.kind, enabled: t.enabled })) || [],
        isAudioMuted,
        isVideoMuted,
        isScreenSharing,
      },
      remoteParticipants: participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        stageRole: p.stageRole,
        isAudioMuted: p.isAudioMuted,
        isVideoMuted: p.isVideoMuted,
        isScreenSharing: p.isScreenSharing,
        stats: p.stats,
      })),
      observabilityLogs: logs,
    };

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetwo-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'errors') return log.type.includes('failed') || log.type.includes('disconnected');
    if (logFilter === 'media') return log.type.includes('device') || log.type.includes('screen') || log.type.includes('quality');
    if (logFilter === 'stage') return log.type.includes('stage');
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="WebRTC Diagnostics & Telemetry" maxWidth="880px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Top Summary Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface-active)',
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                background:
                  connectionState === 'connected'
                    ? 'var(--accent-subtle)'
                    : connectionState === 'degraded'
                    ? 'var(--warning-surface)'
                    : 'var(--danger-surface)',
                color:
                  connectionState === 'connected'
                    ? 'var(--status-online)'
                    : connectionState === 'degraded'
                    ? 'var(--status-idle)'
                    : 'var(--status-dnd)',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              <Activity size={13} />
              <span>{connectionState}</span>
            </div>

            <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }} title={activeRoomId || undefined}>
              Room: <strong style={{ color: 'var(--text-primary)' }}>{activeRoomId ? (activeRoomId.length > 20 ? `${activeRoomId.slice(0, 18)}…` : activeRoomId) : 'None (Idle)'}</strong>
            </span>

            <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>
              Transport:{' '}
              <strong style={{ color: 'var(--accent-light)' }}>
                {connectionStats.transportType ? connectionStats.transportType.toUpperCase() : 'AUTO (SFU/P2P)'}
              </strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Button variant="secondary" size="sm" onClick={handleExportJSON} style={{ gap: 6 }}>
              <Download size={14} />
              <span>Export JSON</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, overflowX: 'auto', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'metrics' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('metrics')}
            style={{ gap: 6 }}
          >
            <Radio size={14} />
            <span>Realtime Stream Metrics ({participants.length})</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('logs')}
            style={{ gap: 6 }}
          >
            <Terminal size={14} />
            <span>Observability Event Stream ({logs.length})</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'tests' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('tests')}
            style={{ gap: 6 }}
          >
            <CheckCircle2 size={14} />
            <span>Automated Test Harness</span>
          </button>
        </div>

        {/* Tab 1: Realtime Stream Metrics */}
        {activeTab === 'metrics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Global Connection Telemetry Card */}
            <div
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  ACTIVE CALL OVERALL TELEMETRY
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'var(--accent-subtle)',
                    color: 'var(--accent)',
                    fontWeight: 600,
                  }}
                >
                  {connectionStats.quality.toUpperCase()} QUALITY
                </span>
              </div>

              <div className="telemetry-metrics-grid">
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">ROUND TRIP (RTT)</span>
                  <span className="telemetry-value">
                    {connectionStats.rtt !== undefined ? `${connectionStats.rtt} ms` : 'Measuring...'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">PACKET LOSS</span>
                  <span
                    className="telemetry-value"
                    style={{
                      color:
                        connectionStats.packetLoss !== undefined && connectionStats.packetLoss > 5
                          ? 'var(--danger)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {connectionStats.packetLoss !== undefined ? `${connectionStats.packetLoss}%` : 'Measuring...'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">JITTER</span>
                  <span className="telemetry-value">
                    {connectionStats.jitter !== undefined ? `${connectionStats.jitter} ms` : 'Measuring...'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">BITRATE</span>
                  <span className="telemetry-value">
                    {connectionStats.bitrate !== undefined
                      ? connectionStats.bitrate >= 1000
                        ? `${(connectionStats.bitrate / 1000).toFixed(2)} Mbps`
                        : `${connectionStats.bitrate} kbps`
                      : 'Measuring...'}
                  </span>
                </div>

                <div className="telemetry-metric-box">
                  <span className="telemetry-label">AUDIO CODEC</span>
                  <span className="telemetry-value" style={{ color: 'var(--accent-light)' }}>
                    {connectionStats.audioCodec ? `${connectionStats.audioCodec} [Measured]` : '[Unavailable]'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">VIDEO CODEC</span>
                  <span className="telemetry-value" style={{ color: 'var(--accent-light)' }}>
                    {connectionStats.videoCodec ? `${connectionStats.videoCodec} [Measured]` : '[Unavailable]'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">RESOLUTION / FPS</span>
                  <span className="telemetry-value">
                    {connectionStats.resolution || 'Unavailable'} / {connectionStats.fps !== undefined ? `${connectionStats.fps} fps` : '--'}
                  </span>
                </div>
                <div className="telemetry-metric-box">
                  <span className="telemetry-label">CANDIDATE TYPE</span>
                  <span className="telemetry-value">
                    {connectionStats.candidateType ? `${connectionStats.candidateType.toUpperCase()} (UDP)` : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Per-Participant List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                PARTICIPANTS & PEER CONNECTION STATES ({participants.length})
              </span>

              {participants.map((p) => {
                const stats = p.stats || connectionStats;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 14 }}>{p.displayName || p.username}</strong>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {p.id}</span>
                        {p.stageRole && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 'var(--radius-xs)',
                              background: 'var(--bg-surface-active)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {p.stageRole.toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                        <span style={{ color: p.isAudioMuted ? 'var(--danger)' : 'var(--status-online)' }}>
                          {p.isAudioMuted ? 'Mic Muted' : 'Mic Live'}
                        </span>
                        <span>•</span>
                        <span style={{ color: p.isVideoMuted ? 'var(--text-muted)' : 'var(--status-online)' }}>
                          {p.isVideoMuted ? 'Cam Off' : 'Cam Live'}
                        </span>
                        {p.isScreenSharing && (
                          <>
                            <span>•</span>
                            <span style={{ color: 'var(--accent-light)' }}>Screen Sharing</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 8, fontSize: 11 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>RTT: </span>
                        <strong>{stats.rtt !== undefined ? `${stats.rtt}ms` : 'Measuring...'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Loss: </span>
                        <strong>{stats.packetLoss !== undefined ? `${stats.packetLoss}%` : 'Measuring...'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Bitrate: </span>
                        <strong>{stats.bitrate !== undefined ? `${stats.bitrate} kbps` : 'Measuring...'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Audio Codec: </span>
                        <strong>{stats.audioCodec || '[Unavailable]'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Observability Event Stream */}
        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['all', 'errors', 'media', 'stage'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn btn-sm ${logFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLogFilter(f)}
                    style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logger.clearLogs();
                  setLogs([]);
                }}
                style={{ gap: 6, fontSize: 11 }}
              >
                <Trash2 size={13} />
                <span>Clear Logs</span>
              </Button>
            </div>

            <div
              style={{
                height: 380,
                overflowY: 'auto',
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                border: '1px solid var(--border-subtle)',
              }}
            >
              {filteredLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                  No observability events recorded yet.
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {entry.timestamp.split('T')[1].slice(0, 8)}
                    </span>
                    <span
                      style={{
                        color: entry.type.includes('failed') || entry.type.includes('disconnected')
                          ? 'var(--danger)'
                          : entry.type.includes('reconnect')
                          ? 'var(--status-idle)'
                          : 'var(--accent)',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      [{entry.type}]
                    </span>
                    <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {entry.details ? JSON.stringify(entry.details) : 'OK'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Automated Test Harness */}
        {activeTab === 'tests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 14 }}>Realtime Subsystem Test Suite</h4>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Verifies adaptation thresholds, per-peer isolation, truthful telemetry, stage security, and reconnect backoff.
                </span>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handleRunTests}
                disabled={isRunningTests}
                style={{ gap: 6 }}
              >
                {isRunningTests ? <RefreshCw size={14} className="spinning" /> : <Play size={14} />}
                <span>{isRunningTests ? 'Executing Scenarios...' : 'Run All Scenarios (A–H)'}</span>
              </Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
              {testResults.length === 0 && !isRunningTests && (
                <div
                  style={{
                    padding: 36,
                    textAlign: 'center',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-subtle)',
                  }}
                >
                  Click "Run All Scenarios" to execute programmatic verification of all meetwo subsystems.
                </div>
              )}

              {testResults.map((res) => (
                <div
                  key={res.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: res.passed ? 'var(--accent-subtle)' : 'var(--danger-surface)',
                    border: `1px solid ${res.passed ? 'var(--accent-border)' : 'var(--danger-border)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {res.passed ? (
                      <CheckCircle2 size={18} style={{ color: 'var(--status-online)', flexShrink: 0 }} />
                    ) : (
                      <XCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        <span style={{ color: 'var(--accent-light)', marginRight: 6 }}>{res.scenario}:</span>
                        {res.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {res.details}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {res.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
