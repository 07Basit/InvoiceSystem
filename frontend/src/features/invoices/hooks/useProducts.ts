import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDto } from 'shared';
import { productService } from '../services/productService';

const key = ['products'] as const;

export function useProducts() {
  return useQuery({ queryKey: key, queryFn: () => productService.list() });
}

export function useProductMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  return {
    create: useMutation({ mutationFn: (dto: ProductDto) => productService.create(dto), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: ProductDto }) => productService.update(id, dto),
      onSuccess: refresh,
    }),
    setActive: useMutation({
      mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => productService.setActive(id, isActive),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => productService.remove(id), onSuccess: refresh }),
  };
}
