export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UserUsage {
  tokenUsed?: number;
  tokenLimit?: number;
  resetAt?: string;
  totalTokenUsed?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  windowSeconds?: number;
  ttl?: number;
}

export interface User {
  _id?: string;
  name: string;
  email: string;
  age?: number;
  usage?: UserUsage;
  isVerified?: boolean;
}

export interface Chat {
  _id: string;
  topic: string;
  model?: string;
  updatedAt: string;
  createdAt?: string;
  usage?: TokenUsage;
  messageCount?: number;
}

export interface Message {
  _id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  usage?: TokenUsage;
  createdAt: string;
  updatedAt?: string;
}

export interface SendMessageResponse {
  message: string;
  chatId: string;
  reply: string;
  usage: TokenUsage;
  tokenUsed: number;
  tokenLimit: number;
  userMessage: Message;
  assistantMessage: Message;
}

export interface AuthResponse {
  message: string;
  name?: string;
  email: string;
  age?: number;
  usage?: TokenUsage;
  requiresVerification?: boolean;
  isVerified?: boolean;
  devOtp?: string;
}

export interface VerifyOtpResponse {
  message: string;
  name: string;
  email: string;
  age?: number;
  usage?: TokenUsage;
  isVerified: boolean;
}

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  tag: string;
  badge?: string;
  enabled?: boolean;
}
