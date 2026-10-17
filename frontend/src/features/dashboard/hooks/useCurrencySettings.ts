import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiResponse, UpdateCurrencySettingsDto } from 'shared';
import { apiClient } from '@/services/api';

export interface CurrencySettingsView {
  baseCurrency: string;
  currencies: Array<{ code: string; name: string }>;
}

const key = ['currency-settings'] as const;

export function useCurrencySettings() {
  return useQuery({
    queryKey: key,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CurrencySettingsView>>('/currency-settings');
      return data.data!;
    },
  });
}

export function useSaveCurrencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateCurrencySettingsDto) => {
      const { data } = await apiClient.put<ApiResponse<CurrencySettingsView>>('/currency-settings', dto);
      return data.data!;
    },
    onSuccess: (view) => {
      qc.setQueryData(key, view);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
