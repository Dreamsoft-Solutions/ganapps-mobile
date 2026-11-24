import type { WalkInteractionInput, WalkPage, WalkParams } from '@/types/walk.types';
import axiosInstance from '../axios-instance';

/** Query string for `GET /walk`: the server takes `seed` as one comma-separated value. */
interface WalkListRequest extends Omit<WalkParams, 'seed'> {
  cursor?: string;
  seed?: string;
}

/**
 * Event Walk endpoints.
 *
 * Paths are version-free; the axios instance already prefixes `/api/v1`.
 */
export const walkAPI = {
  /**
   * Fetches one page of an Event Walk.
   *
   * The first page starts the walk from the position and seeds; a page with a `cursor`
   * continues it and the server ignores the other parameters.
   *
   * @param params - Optional position and seed Ganap ids for the first page
   * @param cursor - The previous page's `nextCursor`, absent for the first page
   * @returns The page of cards with the walk's token and pagination
   */
  list: (params: WalkParams, cursor?: string): Promise<WalkPage> => {
    const request: WalkListRequest = {
      cursor,
      lat: params.lat,
      long: params.long,
      seed: params.seed !== undefined && params.seed.length > 0 ? params.seed.join(',') : undefined,
    };
    return axiosInstance.get<WalkPage>('/walk', { params: request }).then((res) => res.data);
  },

  /**
   * Records that the User opened or skipped a card. The server answers 204 and ignores a repeat.
   *
   * @param input - The Ganap, what happened to it, and the walk's token
   * @returns Nothing
   */
  interact: (input: WalkInteractionInput): Promise<void> =>
    axiosInstance.post<void>('/walk/interactions', input).then((): void => undefined),
};
