import { MediaLifecycleState } from '../../types';
import { logger } from './observability';

export interface ReconnectionCallbacks {
  onStateChange: (state: MediaLifecycleState, userMessage?: string) => void;
  onRetryAttempt?: (attempt: number, maxAttempts: number) => void;
  onPerformIceRestart: () => Promise<boolean>;
}

export class ReconnectionManager {
  private currentState: MediaLifecycleState = 'idle';
  private retryCount: number = 0;
  private readonly maxRetries: number = 5;
  private retryTimeoutId: number | null = null;
  private callbacks: ReconnectionCallbacks;
  private consecutiveDegradedCount: number = 0;
  private isDestroyed: boolean = false;

  constructor(callbacks: ReconnectionCallbacks) {
    this.callbacks = callbacks;
  }

  public getState(): MediaLifecycleState {
    return this.currentState;
  }

  public setConnected(): void {
    if (this.isDestroyed) return;
    this.clearRetryTimer();
    const wasReconnecting = this.currentState === 'reconnecting' || this.currentState === 'recovering';
    this.retryCount = 0;
    this.consecutiveDegradedCount = 0;
    this.currentState = 'connected';

    if (wasReconnecting) {
      logger.log('reconnect_success');
      this.callbacks.onStateChange('connected', 'Back online');
    } else {
      this.callbacks.onStateChange('connected');
    }
  }

  public evaluateMetrics(rtt?: number, packetLoss?: number): void {
    if (this.isDestroyed || this.currentState === 'reconnecting' || this.currentState === 'recovering' || this.currentState === 'failed') {
      return;
    }

    const isPoor = (rtt !== undefined && rtt > 220) || (packetLoss !== undefined && packetLoss > 5);

    if (isPoor) {
      this.consecutiveDegradedCount++;
      if (this.consecutiveDegradedCount >= 2 && this.currentState !== 'degraded') {
        this.currentState = 'degraded';
        logger.log('quality_changed', { rtt, packetLoss, state: 'degraded' });
        this.callbacks.onStateChange('degraded', 'Connection unstable');
      }
    } else {
      if (this.consecutiveDegradedCount > 0) {
        this.consecutiveDegradedCount--;
      }
      if (this.consecutiveDegradedCount === 0 && this.currentState === 'degraded') {
        this.currentState = 'connected';
        logger.log('quality_changed', { rtt, packetLoss, state: 'connected' });
        this.callbacks.onStateChange('connected');
      }
    }
  }

  public triggerReconnection(reason: string): void {
    if (this.isDestroyed) return;
    if (this.currentState === 'reconnecting' || this.currentState === 'recovering') {
      return; // Reconnection already in progress
    }

    this.clearRetryTimer();
    this.retryCount = 0;
    this.currentState = 'reconnecting';
    logger.log('reconnect_started', { reason, attempt: 1 });
    this.callbacks.onStateChange('reconnecting', 'Reconnecting to call...');

    this.attemptReconnect();
  }

  private attemptReconnect(): void {
    if (this.isDestroyed) return;

    if (this.retryCount >= this.maxRetries) {
      this.currentState = 'failed';
      logger.log('transport_failed', { attempts: this.retryCount });
      this.callbacks.onStateChange('failed', 'Connection failed. Please check your network.');
      return;
    }

    this.retryCount++;
    this.callbacks.onRetryAttempt?.(this.retryCount, this.maxRetries);

    // Calculate exponential backoff with jitter: 1000ms * (1.5^(attempt-1)) + jitter
    const baseDelay = Math.min(8000, 1000 * Math.pow(1.5, this.retryCount - 1));
    const jitter = Math.floor(Math.random() * 300);
    const delay = baseDelay + jitter;

    this.retryTimeoutId = window.setTimeout(async () => {
      if (this.isDestroyed || this.currentState !== 'reconnecting') return;

      this.currentState = 'recovering';
      this.callbacks.onStateChange('recovering', `Reconnecting (attempt ${this.retryCount}/${this.maxRetries})...`);

      try {
        const success = await this.callbacks.onPerformIceRestart();
        if (success) {
          this.setConnected();
        } else {
          this.currentState = 'reconnecting';
          this.attemptReconnect();
        }
      } catch (err) {
        console.warn(`[ReconnectionManager] Attempt ${this.retryCount} failed:`, err);
        this.currentState = 'reconnecting';
        this.attemptReconnect();
      }
    }, delay);
  }

  private clearRetryTimer(): void {
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  public reset(): void {
    this.clearRetryTimer();
    this.retryCount = 0;
    this.consecutiveDegradedCount = 0;
    this.currentState = 'idle';
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.clearRetryTimer();
  }
}
