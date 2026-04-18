import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const path = window.location.pathname;
    let token = null;

    if (path.startsWith('/admin')) {
      token = sessionStorage.getItem('admin_token');
    } else if (path.startsWith('/staff')) {
      token = sessionStorage.getItem('staff_token');
    } else {
      token = sessionStorage.getItem('token');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;
