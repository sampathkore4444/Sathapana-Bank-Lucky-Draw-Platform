import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (typeof window !== 'undefined') {
      const customerId = localStorage.getItem('customerId');
      if (customerId) {
        config.headers['X-Customer-Id'] = customerId;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== Refresh Token Rotation ====================

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

const storeSession = (data: { token: string; refreshToken: string; user: unknown }) => {
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
};

const refreshAccessToken = async (): Promise<string> => {
  if (typeof window === 'undefined') throw new Error('Not available on server');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token available');

  const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  storeSession(response.data.data);
  return response.data.data.token;
};

// Response interceptor to handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequest | undefined;
    const status = error.response?.status;
    const url = original?.url || '';

    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      if (typeof window === 'undefined') {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshAccessToken();
        processQueue(null, token);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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

  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
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

  duplicate: (id: string) => api.post(`/campaigns/${id}/duplicate`),

  submitForApproval: (id: string) => api.post(`/campaigns/${id}/submit`),

  approveApprovalLevel: (id: string, level: number, comment?: string) =>
    api.post(`/campaigns/${id}/approval/${level}/approve`, { comment }),

  rejectApprovalLevel: (id: string, level: number, comment?: string) =>
    api.post(`/campaigns/${id}/approval/${level}/reject`, { comment }),

  listForApproval: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/campaigns/approvals/list', { params }),
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

// ==================== Customer API ====================

export const customerApi = {
  dashboard: () => api.get('/customer/dashboard'),

  campaigns: (params?: { page?: number; limit?: number; type?: string; status?: string }) =>
    api.get('/customer/campaigns', { params }),

  checkEligibility: (campaignId: string, customerId: string) =>
    api.get(`/customer/campaigns/${campaignId}/eligibility/${customerId}`),

  entries: (params?: { page?: number; limit?: number; campaignId?: string }) =>
    api.get('/customer/entries', { params }),

  wins: (params?: { page?: number; limit?: number }) =>
    api.get('/customer/wins', { params }),

  notifications: (params?: { page?: number; limit?: number }) =>
    api.get('/customer/notifications', { params }),

  markNotificationRead: (id: string) =>
    api.put(`/customer/notifications/${id}/read`),
};

// ==================== Claim API ====================

export const claimApi = {
  create: (data: { winnerId: string }) => api.post('/claims', data),

  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get('/claims', { params }),

  getById: (id: string) => api.get(`/claims/${id}`),

  addDocument: (
    claimId: string,
    data: { type: string; filePath: string; mimeType: string; size: number; notes?: string }
  ) => api.post(`/claims/${claimId}/documents`, data),

  review: (id: string, data: { status: 'APPROVED' | 'REJECTED'; decisionNote?: string }) =>
    api.put(`/claims/${id}/review`, data),

  fulfill: (id: string) => api.put(`/claims/${id}/fulfill`),

  verifyDocument: (id: string, data: { status: 'VERIFIED' | 'REJECTED'; notes?: string }) =>
    api.put(`/claims/documents/${id}/verify`, data),
};

// ==================== Public API ====================

export const publicApi = {
  campaignWinners: (campaignId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/public/campaigns/${campaignId}/winners`, { params }),
};

export default api;
