import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { mockStore } from '../../lib/supabase/mockStore';
import { useServer } from '../../app/providers/ServerContext';
import { AuditLogEntry } from '../../types';
import { Shield, Clock, Search, Filter, UserCheck } from 'lucide-react';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
  const { activeServer } = useServer();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && activeServer) {
      setLogs(mockStore.getAuditLogs(activeServer.id));
    }
  }, [isOpen, activeServer?.id]);

  const filteredLogs = logs.filter(
    (l) =>
      l.actorName.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Workspace Audit Log" maxWidth="640px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} style={{ color: 'var(--accent)' }} />
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
                {activeServer?.name} Governance History
              </h4>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Immutable administrative actions & channel lifecycle
              </span>
            </div>
          </div>

          <div style={{ position: 'relative', width: 220 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Filter actions or actors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
            />
          </div>
        </div>

        {/* Logs Table / List */}
        <div
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface)',
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No audit records matching your search.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredLogs.map((log, i) => (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: i < filteredLogs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--radius-xs)',
                        background: 'var(--accent-subtle)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UserCheck size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--accent)' }}>{log.actorName}</span>{' '}
                        {log.action}{' '}
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          ({log.target})
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '6px 18px' }}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
