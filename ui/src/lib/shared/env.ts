const DEFAULT_POSTGREST_URL = 'http://localhost:4001';

export const env = {
  postgrestUrl: import.meta.env.VITE_POSTGREST_URL || DEFAULT_POSTGREST_URL,
  /** Optional bearer token for PostgREST (dev JWT or future login token). */
  postgrestJwt: import.meta.env.VITE_POSTGREST_JWT || '',
};
