import { Message, Attachment, MessageReaction, User } from '../../types';
import { messageRepository, formatReactions } from '../repositories';

export { formatReactions };

export class MessageService {
  /**
   * Fetches messages for a channel with authors, reactions, and attachments.
   */
  public static async getMessages(channelId: string): Promise<Message[]> {
    return messageRepository.getMessages(channelId);
  }

  /**
   * Sends a message to a channel with optional attachments and reply parent.
   */
  public static async sendMessage(
    channelId: string,
    author: User,
    content: string,
    replyToId?: string | null,
    attachments?: Attachment[]
  ): Promise<Message> {
    return messageRepository.sendMessage(channelId, author, content, replyToId, attachments);
  }

  /**
   * Edits message content.
   */
  public static async editMessage(messageId: string, authorId: string, content: string): Promise<void> {
    return messageRepository.editMessage(messageId, authorId, content);
  }

  /**
   * Deletes a message.
   */
  public static async deleteMessage(messageId: string): Promise<void> {
    return messageRepository.deleteMessage(messageId);
  }

  /**
   * Authoritative toggle reaction in Supabase.
   */
  public static async toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    return messageRepository.toggleReaction(messageId, userId, emoji);
  }
}
