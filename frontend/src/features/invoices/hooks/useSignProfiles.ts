import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SignProfileDto } from 'shared';
import { signService } from '../services/signService';

const key = ['sign-profiles'] as const;

export function useSignProfiles() {
  return useQuery({ queryKey: key, queryFn: () => signService.list() });
}

export function useSignProfileMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (dto: SignProfileDto) => signService.create(dto), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: SignProfileDto }) => signService.update(id, dto),
      onSuccess: refresh,
    }),
    setDefault: useMutation({ mutationFn: (id: string) => signService.setDefault(id), onSuccess: refresh }),
    setActive: useMutation({
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => signService.setActive(id, isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => signService.remove(id), onSuccess: refresh }),
  };
}
