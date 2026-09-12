/**
 * Meetwo V4 - Structured Observability & Telemetry Event Logger
 * Records lifecycle events, transitions, and network state changes without logging sensitive media content.
 */

export type ObservabilityEventType =
  | 'call_started'
  | 'call_joined'
  | 'call_left'
  | 'transport_connected'
  | 'transport_failed'
  | 'reconnect_started'
  | 'reconnect_success'
  | 'device_changed'
  | 'device_disconnected'
  | 'screen_share_started'
  | 'screen_share_stopped'
  | 'quality_changed'
  | 'stage_role_changed';

export interface ObservabilityLogEntry {
  id: string;
  timestamp: string;
  type: ObservabilityEventType;
  details?: Record<string, any>;
}

class ObservabilityLogger {
  private logs: ObservabilityLogEntry[] = [];
  private maxLogs: number = 150;
  private listeners: Set<(entry: ObservabilityLogEntry) => void> = new Set();

  public log(type: ObservabilityEventType, details?: Record<string, any>): void {
    const entry: ObservabilityLogEntry = {
      id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output formatted console log in dev
    console.info(`[Meetwo Observability] [${type}]`, details || '');

    // Notify active diagnostics listeners
    this.listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch {}
    });
  }

  public getRecentLogs(): ObservabilityLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public subscribe(listener: (entry: ObservabilityLogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public exportLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new ObservabilityLogger();
