import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recycleBinService } from '../services/recycleBinService';
import { useToast } from '@/components/ui/toast';

export function useRecycleBin() {
  return useQuery({
    queryKey: ['recycle-bin'],
    queryFn: async () => {
      const res = await recycleBinService.getDeleted();
      return res.data ?? { invoices: [], importers: [] };
    },
    staleTime: 0,
  });
}

export function useRestoreRecord() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ type, id }: { type: 'invoice' | 'importer'; id: string }) =>
      recycleBinService.restore(type, id),
    onSuccess: (_data, { type }) => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      queryClient.invalidateQueries({ queryKey: [type === 'invoice' ? 'invoices' : 'importers'] });
      showToast(`${type === 'invoice' ? 'Invoice' : 'Importer'} restored successfully`, undefined, 'success');
    },
    onError: () => {
      showToast('Failed to restore record', undefined, 'error');
    },
  });
}

export function usePermanentDelete() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ type, id }: { type: 'invoice' | 'importer'; id: string }) =>
      recycleBinService.permanentDelete(type, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] });
      showToast('Record permanently deleted', undefined, 'success');
    },
    onError: () => {
      showToast('Failed to permanently delete record', undefined, 'error');
    },
  });
}
