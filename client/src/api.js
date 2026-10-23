import axios from 'axios';
import { captureError } from './monitoring.js';

export const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Report server failures (5xx) and unreachable servers; 4xx are normal user errors.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (!error.response || status >= 500) {
      captureError(error, { url: error.config?.url, method: error.config?.method, status });
    }
    return Promise.reject(error);
  }
);

/** Turns any API error into a message a user can act on. */
export const errMsg = (e) => {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.request && !e.response) return 'Cannot reach the server. Check your connection and try again.';
  return e?.message || 'Something went wrong';
};
