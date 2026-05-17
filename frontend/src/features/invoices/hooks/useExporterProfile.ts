import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpsertExporterProfileDto } from 'shared';
import { exporterService } from '../services/exporterService';

const key = ['exporter-profile'] as const;

export function useExporterProfile() {
  return useQuery({
    queryKey: key,
    queryFn: () => exporterService.getProfile(),
  });
}

export function useSaveExporterProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpsertExporterProfileDto) => exporterService.saveProfile(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
