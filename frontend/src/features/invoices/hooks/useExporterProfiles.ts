import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExporterProfileDto } from 'shared';
import { exporterService } from '../services/exporterService';

const key = ['exporter-profiles'] as const;

export function useExporterProfiles() {
  return useQuery({ queryKey: key, queryFn: () => exporterService.list() });
}

export function useExporterProfileMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (dto: ExporterProfileDto) => exporterService.create(dto), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: ExporterProfileDto }) => exporterService.update(id, dto),
      onSuccess: refresh,
    }),
    setDefault: useMutation({ mutationFn: (id: string) => exporterService.setDefault(id), onSuccess: refresh }),
    setActive: useMutation({
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => exporterService.setActive(id, isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => exporterService.remove(id), onSuccess: refresh }),
  };
}
