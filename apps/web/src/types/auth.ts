// 认证相关类型定义

export interface User {
  id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User | null;
  session: any;
  error?: string;
}
