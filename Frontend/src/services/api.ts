import type { User, Chat, Message, SendMessageResponse, AuthResponse } from '../types';

const API_BASE = ''; // proxied via Vite to http://localhost:3000

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('thunder:auth-expired', {
            detail: { message: data.message || 'You need to login first' },
          })
        );
      }
      const errorMsg = data.message || data.messages || `Request failed with status ${response.status}`;
      throw new ApiError(errorMsg, response.status);
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

    login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
      return request<AuthResponse>('/user/login', {
        method: 'POST',
        body: JSON.stringify(data),
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
    getMessages: async (chatId: string): Promise<{ messages: string; msg: Message[] }> => {
      return request<{ messages: string; msg: Message[] }>(`/msg/${chatId}`, {
        method: 'GET',
      });
    },

    sendMessage: async (params: {
      chatId?: string;
      content: string;
      model?: string;
    }): Promise<SendMessageResponse> => {
      const endpoint = params.chatId ? `/msg/${params.chatId}` : '/msg/';
      const bodyPayload: any = { content: params.content };
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
      },
      callbacks: StreamMessageCallbacks = {}
    ): Promise<SendMessageResponse> => {
      const endpoint = params.chatId ? `/msg/${params.chatId}/stream` : '/msg/stream';
      const bodyPayload: any = { content: params.content };
      if (!params.chatId && params.model) {
        bodyPayload.model = params.model;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
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
};

export interface StreamMessageCallbacks {
  onStart?: (data: { chatId: string; userMessage?: Message }) => void;
  onChunk?: (chunk: string) => void;
  onDone?: (data: SendMessageResponse) => void;
  onError?: (error: Error) => void;
}
