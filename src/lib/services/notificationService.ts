import { notificationRepository, NotificationItem } from '../repositories';

export type { NotificationItem };

export class NotificationService {
  /**
   * Fetches persistent notifications from PostgreSQL.
   */
  public static async getNotifications(userId: string): Promise<NotificationItem[]> {
    return notificationRepository.getNotifications(userId);
  }

  /**
   * Marks a notification as read.
   */
  public static async markAsRead(notificationId: string): Promise<void> {
    return notificationRepository.markAsRead(notificationId);
  }

  /**
   * Marks all notifications as read for a user.
   */
  public static async markAllAsRead(userId: string): Promise<void> {
    return notificationRepository.markAllAsRead(userId);
  }
}
