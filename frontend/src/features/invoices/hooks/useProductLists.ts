import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductListDto } from 'shared';
import { productListService } from '../services/productListService';

const key = ['product-lists'] as const;

export function useProductLists() {
  return useQuery({ queryKey: key, queryFn: () => productListService.list() });
}

export function useProductListMutations() {
  const queryClient = useQueryClient();
  return {
    create: useMutation({
      mutationFn: (dto: ProductListDto) => productListService.create(dto),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    }),
    // deleting a list also deletes its products
    remove: useMutation({
      mutationFn: (id: string) => productListService.remove(id),
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: key }); queryClient.invalidateQueries({ queryKey: ['products'] }); },
    }),
  };
}
