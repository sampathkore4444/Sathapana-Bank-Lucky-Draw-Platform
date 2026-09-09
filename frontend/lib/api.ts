import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== Auth API ====================

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => api.post('/auth/register', data),
  
  getProfile: () => api.get('/auth/profile'),
  
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) =>
    api.put('/auth/profile', data),
};

// ==================== Campaign API ====================

export const campaignApi = {
  list: (params?: { page?: number; limit?: number; status?: string; type?: string }) =>
    api.get('/campaigns', { params }),
  
  getById: (id: string) => api.get(`/campaigns/${id}`),
  
  create: (data: any) => api.post('/campaigns', data),
  
  update: (id: string, data: any) => api.put(`/campaigns/${id}`, data),
  
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  
  activate: (id: string) => api.post(`/campaigns/${id}/activate`),
  
  pause: (id: string) => api.post(`/campaigns/${id}/pause`),
  
  close: (id: string) => api.post(`/campaigns/${id}/close`),
  
  getStats: (id: string) => api.get(`/campaigns/${id}/stats`),
};

// ==================== Entry API ====================

export const entryApi = {
  register: (data: {
    customerId: string;
    campaignId: string;
    accountId?: string;
    entryType: string;
    triggerTransactionId?: string;
  }) => api.post('/entries', data),
  
  list: (params?: { page?: number; limit?: number; customerId?: string; campaignId?: string }) =>
    api.get('/entries', { params }),
  
  getCustomerEntries: (customerId: string, page?: number) =>
    api.get(`/entries/customer/${customerId}`, { params: { page } }),
  
  getCustomerSummary: (customerId: string) =>
    api.get(`/entries/customer/${customerId}/summary`),
  
  checkEligibility: (customerId: string, campaignId: string) =>
    api.get(`/entries/eligibility/${customerId}/${campaignId}`),
};

// ==================== Draw API ====================

export const drawApi = {
  execute: (data: { campaignId: string; numberOfWinners?: number; numberOfAlternates?: number }) =>
    api.post('/draws', data),
  
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/draws', { params }),
  
  getById: (id: string) => api.get(`/draws/${id}`),
  
  addWitness: (id: string) => api.post(`/draws/${id}/witness`),
  
  verify: (id: string) => api.post(`/draws/${id}/verify`),
  
  getCampaignDraws: (campaignId: string) =>
    api.get(`/draws/campaign/${campaignId}`),
};

// ==================== Prize API ====================

export const prizeApi = {
  list: (params?: { page?: number; limit?: number; campaignId?: string }) =>
    api.get('/prizes', { params }),
  
  getById: (id: string) => api.get(`/prizes/${id}`),
  
  create: (data: any) => api.post('/prizes', data),
  
  update: (id: string, data: any) => api.put(`/prizes/${id}`, data),
  
  delete: (id: string) => api.delete(`/prizes/${id}`),
  
  getCampaignPrizes: (campaignId: string) =>
    api.get(`/prizes/campaign/${campaignId}`),
};

// ==================== Winner API ====================

export const winnerApi = {
  list: (params?: { page?: number; limit?: number; status?: string; campaignId?: string }) =>
    api.get('/winners', { params }),
  
  getById: (id: string) => api.get(`/winners/${id}`),
  
  updateStatus: (id: string, data: { status: string; notes?: string }) =>
    api.put(`/winners/${id}/status`, data),
  
  getCampaignWinners: (campaignId: string) =>
    api.get(`/winners/campaign/${campaignId}`),
  
  getCustomerWins: (customerId: string) =>
    api.get(`/winners/customer/${customerId}`),
  
  promoteAlternate: (id: string) =>
    api.post(`/winners/${id}/promote-alternate`),
};

// ==================== Admin API ====================

export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  
  getCampaignPerformance: () => api.get('/admin/reports/campaign-performance'),
  
  getWinnerFulfillment: () => api.get('/admin/reports/winner-fulfillment'),
  
  getAuditLogs: (params?: { page?: number; limit?: number; entityType?: string }) =>
    api.get('/admin/audit-logs', { params }),
  
  getUsers: (params?: { page?: number; limit?: number; role?: string }) =>
    api.get('/admin/users', { params }),
  
  updateUserRole: (id: string, role: string) =>
    api.put(`/admin/users/${id}/role`, { role }),
  
  updateUserStatus: (id: string, isActive: boolean) =>
    api.put(`/admin/users/${id}/status`, { isActive }),
};

export default api;
