import { ForumPost, User } from '../../types';
import { forumRepository, ForumReplyItem } from '../repositories';

export type ForumReply = ForumReplyItem;

export class ForumService {
  /**
   * Fetches all forum posts for a given channel.
   */
  public static async getPosts(channelId: string): Promise<ForumPost[]> {
    return forumRepository.getPosts(channelId);
  }

  /**
   * Creates a new forum post.
   */
  public static async createPost(
    channelId: string,
    author: User,
    title: string,
    content: string,
    tags: string[] = []
  ): Promise<ForumPost> {
    return forumRepository.createPost(channelId, author, title, content, tags);
  }

  /**
   * Fetches replies for a specific forum post.
   */
  public static async getReplies(postId: string): Promise<ForumReplyItem[]> {
    return forumRepository.getReplies(postId);
  }

  /**
   * Adds a reply to a forum post.
   */
  public static async addReply(postId: string, author: User, content: string): Promise<ForumReplyItem> {
    return forumRepository.addReply(postId, author, content);
  }

  /**
   * Marks a forum post as solved.
   */
  public static async markSolved(postId: string, isSolved: boolean): Promise<void> {
    return forumRepository.markSolved(postId, isSolved);
  }
}
