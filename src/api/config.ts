/**
 * Root URL of the Ganapps API, including the server's global `/api` prefix and
 * its URI version segment.
 *
 * The server sets `setGlobalPrefix('api')` and enables URI versioning, and every
 * controller is declared `version: '1'`, so routes resolve as `/api/v1/<path>`.
 * Endpoint modules therefore hold version-free paths such as `/auth/login`.
 *
 * Override with `EXPO_PUBLIC_API_URL`. Note that `localhost` refers to the
 * device, not the host machine: use `http://10.0.2.2:3000/api/v1` on an Android
 * emulator, or the host's LAN IP on a physical device.
 */
export const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
