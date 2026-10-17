import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BankProfileDto } from 'shared';
import { bankService } from '../services/bankService';

const key = ['bank-profiles'] as const;

export function useBankProfiles() {
  return useQuery({ queryKey: key, queryFn: () => bankService.list() });
}

export function useBankProfileMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (dto: BankProfileDto) => bankService.create(dto), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: BankProfileDto }) => bankService.update(id, dto),
      onSuccess: refresh,
    }),
    setDefault: useMutation({ mutationFn: (id: string) => bankService.setDefault(id), onSuccess: refresh }),
    setActive: useMutation({
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => bankService.setActive(id, isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => bankService.remove(id), onSuccess: refresh }),
  };
}
