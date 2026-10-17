import type { AuthSession, AuthUser, ChangePasswordDto, LoginDto, UpdateProfileDto } from 'shared';
import { apiClient } from '@/services/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface MeResponse {
  user: AuthUser;
  rememberMe: boolean;
  expiresAt: string | null;
}

export const authService = {
  async login(dto: LoginDto): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/login', dto);
    return data.data;
  },
  async me(): Promise<MeResponse> {
    const { data } = await apiClient.get<ApiResponse<MeResponse>>('/auth/me');
    return data.data;
  },
  async updateProfile(dto: UpdateProfileDto): Promise<AuthUser> {
    const { data } = await apiClient.patch<ApiResponse<AuthUser>>('/auth/me', dto);
    return data.data;
  },
  async changePassword(dto: ChangePasswordDto): Promise<AuthSession> {
    const { data } = await apiClient.post<ApiResponse<AuthSession>>('/auth/change-password', dto);
    return data.data;
  },
  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
  async signOutEverywhere(): Promise<void> {
    await apiClient.post('/auth/sign-out-everywhere');
  },
};
