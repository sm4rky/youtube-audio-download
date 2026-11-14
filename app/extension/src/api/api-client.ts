import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
  // Keep the transport consistent in Chrome and tests. The fetch adapter keeps
  // the timeout active until the response body has been read.
  adapter: 'fetch',
  withCredentials: false,
  fetchOptions: { redirect: 'error' },
  responseType: 'json',
  transitional: { silentJSONParsing: false, clarifyTimeoutError: true },
});
