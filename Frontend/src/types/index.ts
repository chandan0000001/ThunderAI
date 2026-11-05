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
  isUnlimited?: boolean;
}

export interface User {
  _id?: string;
  name: string;
  email: string;
  age?: number;
  avatar?: string;
  role?: string;
  isAdmin?: boolean;
  usage?: UserUsage;
  isVerified?: boolean;
  isUnlimited?: boolean;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | string;
  age?: number;
  avatar?: string;
  isVerified?: boolean;
  authProvider?: string;
  usage?: UserUsage;
  liveTokens?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminStats {
  totalUsers: number;
  adminCount: number;
  totalChats: number;
  totalMessages: number;
  totalTokensUsed: number;
  governanceStatus: string;
  slidingWindowSeconds: number;
  tokenLimit: number;
}

export interface ByokProviderStatus {
  provider: 'openrouter' | 'groq' | 'claude' | 'chatgpt';
  active: boolean;
  keyCount: number;
  maskedKey?: string;
  ttlRemainingSeconds?: number;
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
  avatar?: string;
  role?: string;
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
  isEnvActive?: boolean;
}
