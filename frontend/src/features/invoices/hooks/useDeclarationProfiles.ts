import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeclarationProfileDto } from 'shared';
import { declarationService } from '../services/declarationService';

const key = ['declaration-profiles'] as const;

export function useDeclarationProfiles() {
  return useQuery({ queryKey: key, queryFn: () => declarationService.list() });
}

export function useDeclarationProfileMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (dto: DeclarationProfileDto) => declarationService.create(dto), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: DeclarationProfileDto }) => declarationService.update(id, dto),
      onSuccess: refresh,
    }),
    setDefault: useMutation({ mutationFn: (id: string) => declarationService.setDefault(id), onSuccess: refresh }),
    setActive: useMutation({
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => declarationService.setActive(id, isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => declarationService.remove(id), onSuccess: refresh }),
  };
}
