import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (e) => e?.response?.data?.message || e?.message || 'Something went wrong';
