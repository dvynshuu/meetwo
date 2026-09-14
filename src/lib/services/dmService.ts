import { DMConversation, DMMessage, User } from '../../types';
import { dmRepository } from '../repositories';

export class DMService {
  /**
   * Retrieves all DM conversations for a user with participant profiles and latest message.
   */
  public static async getConversations(userId: string): Promise<DMConversation[]> {
    return dmRepository.getConversations(userId);
  }

  /**
   * Starts a 1:1 conversation with another user or returns the existing conversation ID.
   */
  public static async startConversation(currentUser: User, targetUser: User): Promise<string> {
    return dmRepository.startConversation(currentUser, targetUser);
  }

  /**
   * Fetches messages for a specific conversation.
   */
  public static async getMessages(conversationId: string): Promise<DMMessage[]> {
    return dmRepository.getMessages(conversationId);
  }

  /**
   * Sends a message in a DM conversation.
   */
  public static async sendMessage(
    conversationId: string,
    author: User,
    content: string
  ): Promise<DMMessage> {
    return dmRepository.sendMessage(conversationId, author, content);
  }
}
