import type { AxiosRequestConfig } from 'axios';

/** Axios config metadata that limits a durable replay request to its queued owner. */
export interface SessionBoundRequestConfig extends AxiosRequestConfig {
  expectedAuthUserId?: string;
}
