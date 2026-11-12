import type { User, Chat, Message, SendMessageResponse, AuthResponse, VerifyOtpResponse, AdminUser, AdminStats, ByokProviderStatus } from '../types';

// In production with decoupled deployment (Cloudflare Pages + Koyeb), set VITE_API_BASE_URL in Cloudflare Pages dashboard
// (e.g. VITE_API_BASE_URL=https://your-backend.koyeb.app). In local dev or unified mode, defaults to empty string.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

class ApiError extends Error {
  status: number;
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (
        response.status === 401 &&
        typeof window !== 'undefined' &&
        endpoint !== '/user/profile' &&
        endpoint !== '/user/login'
      ) {
        window.dispatchEvent(
          new CustomEvent('thunder:auth-expired', {
            detail: { message: data.message || 'You need to login first' },
          })
        );
      }
      const errorMsg = data.message || data.messages || `Request failed with status ${response.status}`;
      throw new ApiError(errorMsg, response.status, data);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network connection failed. Ensure backend server is running.', 0);
  }
}

export const api = {
  auth: {
    signup: async (data: { name: string; email: string; password: string; age?: number }): Promise<AuthResponse> => {
      return request<AuthResponse>('/user/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    verifyOTP: async (data: { email: string; otp: string }): Promise<VerifyOtpResponse> => {
      return request<VerifyOtpResponse>('/user/verify-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    resendOTP: async (data: { email: string }): Promise<{ message: string }> => {
      return request<{ message: string }>('/user/resend-otp', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
      return request<AuthResponse>('/user/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    forgotPassword: async (data: { email: string }): Promise<{ message: string; devLink?: string }> => {
      return request<{ message: string; devLink?: string }>('/user/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    resetPassword: async (data: { token: string; newPassword: string }): Promise<{ message: string }> => {
      return request<{ message: string }>('/user/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    googleLogin: async (credential: string): Promise<AuthResponse> => {
      return request<AuthResponse>('/user/google-login', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
    },

    logout: async (): Promise<{ message: string }> => {
      return request<{ message: string }>('/user/logout', {
        method: 'POST',
      });
    },

    getProfile: async (): Promise<User> => {
      return request<User>('/user/profile', {
        method: 'GET',
      });
    },

    deleteAccount: async (): Promise<{ message: string }> => {
      return request<{ message: string }>('/user/delete', {
        method: 'DELETE',
      });
    },
  },

  chat: {
    getRecent: async (): Promise<{ message: string; chats: Chat[] }> => {
      return request<{ message: string; chats: Chat[] }>('/chat/getRecentChat', {
        method: 'GET',
      });
    },

    createChat: async (model: string): Promise<Chat> => {
      return request<Chat>('/chat/createChat', {
        method: 'POST',
        body: JSON.stringify({ model }),
      });
    },

    getSingleChat: async (chatId: string): Promise<Chat> => {
      return request<Chat>(`/chat/${chatId}`, {
        method: 'GET',
      });
    },

    deleteChat: async (chatId: string): Promise<{ message: string }> => {
      return request<{ message: string }>(`/chat/${chatId}`, {
        method: 'DELETE',
      });
    },
  },

  message: {
    uploadDocument: async (file: File): Promise<{
      fileName: string;
      fileType?: string;
      charCount: number;
      truncated: boolean;
      snippet: string;
      textContent: string;
      dimensions?: { width: number; height: number } | null;
    }> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/msg/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new ApiError(data.message || 'Failed to upload document', response.status);
      }

      return response.json();
    },

    getMessages: async (chatId: string): Promise<{ messages: string; msg: Message[] }> => {
      return request<{ messages: string; msg: Message[] }>(`/msg/${chatId}`, {
        method: 'GET',
      });
    },

    sendMessage: async (params: {
      chatId?: string;
      content: string;
      model?: string;
      useThunderEngine?: boolean;
      attachment?: { fileName: string; textContent: string };
      webSearch?: boolean;
    }): Promise<SendMessageResponse> => {
      const endpoint = params.chatId ? `/msg/${params.chatId}` : '/msg/';
      const bodyPayload: any = {
        content: params.content,
        useThunderEngine: params.useThunderEngine ?? true,
        attachment: params.attachment,
        webSearch: params.webSearch ?? false,
      };
      if (!params.chatId && params.model) {
        bodyPayload.model = params.model;
      }

      return request<SendMessageResponse>(endpoint, {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
    },

    streamMessage: async (
      params: {
        chatId?: string;
        content: string;
        model?: string;
        useThunderEngine?: boolean;
        attachment?: { fileName: string; textContent: string };
        webSearch?: boolean;
      },
      callbacks: StreamMessageCallbacks = {}
    ): Promise<SendMessageResponse> => {
      const endpoint = `${API_BASE}${params.chatId ? `/msg/${params.chatId}/stream` : '/msg/stream'}`;
      const bodyPayload: any = {
        content: params.content,
        useThunderEngine: params.useThunderEngine ?? true,
        attachment: params.attachment,
        webSearch: params.webSearch ?? false,
      };
      if (!params.chatId && params.model) {
        bodyPayload.model = params.model;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 401 && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('thunder:auth-expired', {
              detail: { message: data.message || 'You need to login first' },
            })
          );
        }
        const errorMsg = data.message || `Streaming request failed with status ${response.status}`;
        throw new ApiError(errorMsg, response.status);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new ApiError('ReadableStream not supported by this browser', 0);
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let donePayload: SendMessageResponse | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const eventData = JSON.parse(jsonStr);
            if (eventData.type === 'start') {
              callbacks.onStart?.(eventData);
            } else if (eventData.type === 'chunk') {
              callbacks.onChunk?.(eventData.chunk);
            } else if (eventData.type === 'done') {
              donePayload = eventData;
              callbacks.onDone?.(eventData);
            } else if (eventData.type === 'error') {
              const err = new Error(eventData.message || 'Stream processing failed');
              callbacks.onError?.(err);
              throw err;
            }
          } catch (err: any) {
            if (jsonStr.includes('"error"')) throw err;
            console.warn('Could not parse SSE message:', jsonStr, err);
          }
        }
      }

      if (!donePayload) {
        throw new ApiError('Stream closed before completion', 0);
      }

      return donePayload;
    },
  },

  admin: {
    getUsers: async (params?: { search?: string; role?: string; page?: number }): Promise<{ users: AdminUser[]; total: number; page: number; pages: number }> => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.role) query.append('role', params.role);
      if (params?.page) query.append('page', params.page.toString());
      const qs = query.toString();
      return request(`/admin/users${qs ? `?${qs}` : ''}`, { method: 'GET' });
    },

    createUser: async (data: { name: string; email: string; password: string; role?: string; age?: number }): Promise<{ message: string; user: AdminUser }> => {
      return request('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    inviteUser: async (data: { name?: string; email: string; role?: string }): Promise<{ message: string; tempPassword?: string; emailSent?: boolean; user: AdminUser }> => {
      return request('/admin/users/invite', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    deleteUser: async (userId: string): Promise<{ message: string }> => {
      return request(`/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },

    updateRole: async (userId: string, role: 'user' | 'admin'): Promise<{ message: string; user: { _id: string; email: string; role: string } }> => {
      return request(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },

    resetQuota: async (userId: string): Promise<{ message: string }> => {
      return request(`/admin/users/${userId}/reset-quota`, {
        method: 'PATCH',
      });
    },

    getStats: async (): Promise<AdminStats> => {
      return request<AdminStats>('/admin/stats', {
        method: 'GET',
      });
    },
  },

  byok: {
    getStatus: async (): Promise<{ providers: ByokProviderStatus[] }> => {
      return request<{ providers: ByokProviderStatus[] }>('/user/custom-api-key', {
        method: 'GET',
      });
    },

    saveKey: async (
      provider: string,
      apiKey: string
    ): Promise<{ message: string; provider: string; keyCount: number; ttl: number; masked?: string }> => {
      return request('/user/custom-api-key', {
        method: 'POST',
        body: JSON.stringify({ provider, apiKey }),
      });
    },

    deleteKey: async (provider: string): Promise<{ message: string }> => {
      return request(`/user/custom-api-key/${provider}`, {
        method: 'DELETE',
      });
    },
  },
};

export interface StreamMessageCallbacks {
  onStart?: (data: { chatId: string; userMessage?: Message }) => void;
  onChunk?: (chunk: string) => void;
  onDone?: (data: SendMessageResponse) => void;
  onError?: (error: Error) => void;
}
