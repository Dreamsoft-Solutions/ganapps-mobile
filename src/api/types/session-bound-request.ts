import type { AxiosRequestConfig } from 'axios';

/** Axios metadata that binds each request and durable replay to its auth session. */
export interface SessionBoundRequestConfig extends AxiosRequestConfig {
  expectedAuthSessionId?: number;
  expectedAuthUserId?: string;
  requestAuthUserId?: string | null;
  requestAuthToken?: string | null;
  requestAuthVersion?: number;
}
