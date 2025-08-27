import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('API Response Error:', message);
    return Promise.reject(new Error(message));
  }
);

// Health API
export const healthAPI = {
  getHealth: () => api.get('/health'),
};

// Bids API
export const bidsAPI = {
  getBids: (params = {}) => api.get('/bids', { params }),
  deleteBid: (id) => api.delete(`/bids/${id}`),
  fetchSeptaBids: () => api.post('/bids/fetch/septa'),
};

// Credentials API
export const credentialsAPI = {
  getCredentials: () => api.get('/credentials'),
  saveSeptaCredentials: (credentials) => api.post('/credentials/septa', credentials),
  testSeptaCredentials: () => api.post('/credentials/septa/test'),
  deleteSeptaCredentials: () => api.delete('/credentials/septa'),
};

export default api;