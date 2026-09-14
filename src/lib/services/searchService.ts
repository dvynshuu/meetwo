import { searchRepository, GlobalSearchFilters, DetailedSearchResult } from '../repositories';

export type { GlobalSearchFilters, DetailedSearchResult };

export class SearchService {
  /**
   * Searches across real messages, channels, and forum posts in Supabase.
   * Clearly distinguishes between empty results and backend search failures.
   */
  public static async search(
    filters: GlobalSearchFilters,
    accessibleChannelIds: string[] = []
  ): Promise<DetailedSearchResult[]> {
    return searchRepository.search(filters, accessibleChannelIds);
  }
}
