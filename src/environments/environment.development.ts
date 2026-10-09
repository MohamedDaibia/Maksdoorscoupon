/**
 * DEVELOPMENT settings (used by `ng serve`). Angular swaps this file in for environment.ts.
 * Calls to /api are forwarded to the API by proxy.conf.json (https://localhost:44308, the API's IIS Express address).
 */
export const environment = {
  production: false,
  apiUrl: 'https://localhost:44308/api',
};
