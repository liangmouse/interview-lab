// 通用类型定义

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface SelectOption {
  label: string;
  value: string | number;
}
