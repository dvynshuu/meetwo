import { isSupabaseConfigured } from '../supabase/client';
import {
  IMessageRepository,
  IServerRepository,
  IChannelRepository,
  IDMRepository,
  IBookmarkRepository,
  IThreadRepository,
  IForumRepository,
  INotificationRepository,
  IReadStateRepository,
  IStageRepository,
  ISearchRepository,
  IFriendRepository,
} from './types';
import {
  SupabaseMessageRepository,
  SupabaseServerRepository,
  SupabaseChannelRepository,
  SupabaseDMRepository,
  SupabaseBookmarkRepository,
  SupabaseThreadRepository,
  SupabaseForumRepository,
  SupabaseNotificationRepository,
  SupabaseReadStateRepository,
  SupabaseStageRepository,
  SupabaseSearchRepository,
  SupabaseFriendRepository,
} from './supabaseRepository';
import {
  MockMessageRepository,
  MockServerRepository,
  MockChannelRepository,
  MockDMRepository,
  MockBookmarkRepository,
  MockThreadRepository,
  MockForumRepository,
  MockNotificationRepository,
  MockReadStateRepository,
  MockStageRepository,
  MockSearchRepository,
  MockFriendRepository,
} from './mockRepository';

const isProduction =
  (import.meta as any).env?.VITE_APP_ENV === 'production' ||
  (import.meta as any).env?.PROD;

// In production, always use Supabase repositories. Never fall back to mock.
const useSupabase = isProduction || isSupabaseConfigured;

export const messageRepository: IMessageRepository = useSupabase
  ? new SupabaseMessageRepository()
  : new MockMessageRepository();

export const serverRepository: IServerRepository = useSupabase
  ? new SupabaseServerRepository()
  : new MockServerRepository();

export const channelRepository: IChannelRepository = useSupabase
  ? new SupabaseChannelRepository()
  : new MockChannelRepository();

export const dmRepository: IDMRepository = useSupabase
  ? new SupabaseDMRepository()
  : new MockDMRepository();

export const bookmarkRepository: IBookmarkRepository = useSupabase
  ? new SupabaseBookmarkRepository()
  : new MockBookmarkRepository();

export const threadRepository: IThreadRepository = useSupabase
  ? new SupabaseThreadRepository()
  : new MockThreadRepository();

export const forumRepository: IForumRepository = useSupabase
  ? new SupabaseForumRepository()
  : new MockForumRepository();

export const notificationRepository: INotificationRepository = useSupabase
  ? new SupabaseNotificationRepository()
  : new MockNotificationRepository();

export const readStateRepository: IReadStateRepository = useSupabase
  ? new SupabaseReadStateRepository()
  : new MockReadStateRepository();

export const stageRepository: IStageRepository = useSupabase
  ? new SupabaseStageRepository()
  : new MockStageRepository();

export const searchRepository: ISearchRepository = useSupabase
  ? new SupabaseSearchRepository()
  : new MockSearchRepository();

export const friendRepository: IFriendRepository = useSupabase
  ? new SupabaseFriendRepository()
  : new MockFriendRepository();

export { formatReactions } from './supabaseRepository';
export * from './types';
