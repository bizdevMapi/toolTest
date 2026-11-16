import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const groundTruthAPI = {
  upload: (data) => api.post('/gt/upload', data),
  get: () => api.get('/gt'),
  getAvailable: () => api.get('/gt/available'),
  delete: () => api.delete('/gt'),
};

export const vendorAPI = {
  upload: (data) => api.post('/vendor/upload', data),
  uploadZip: (formData) => api.post('/vendor/upload-zip', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getSubmissions: () => api.get('/vendor/submissions'),
  calculateFinal: () => api.post('/vendor/calculate-final'),
  getResults: () => api.get('/vendor/results'),
  getIntermediateTables: () => api.get('/vendor/intermediate-tables'),
  deleteAll: () => api.delete('/vendor/all'),
};

export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
