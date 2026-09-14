import { StageChannelState } from '../../types';
import { stageRepository } from '../repositories';

export class StageService {
  /**
   * Fetches authoritative Stage state from PostgreSQL.
   */
  public static async getStageState(channelId: string): Promise<StageChannelState | null> {
    return stageRepository.getStageState(channelId);
  }

  /**
   * Raises hand in stage queue.
   */
  public static async raiseHand(channelId: string): Promise<void> {
    return stageRepository.raiseHand(channelId);
  }

  /**
   * Lowers hand for self or target participant.
   */
  public static async lowerHand(channelId: string, targetUserId?: string): Promise<void> {
    return stageRepository.lowerHand(channelId, targetUserId);
  }

  /**
   * Moderates speaker role (promote to speaker or demote to listener).
   */
  public static async moderateSpeaker(channelId: string, targetUserId: string, action: 'invite' | 'demote'): Promise<void> {
    return stageRepository.moderateSpeaker(channelId, targetUserId, action);
  }
}
