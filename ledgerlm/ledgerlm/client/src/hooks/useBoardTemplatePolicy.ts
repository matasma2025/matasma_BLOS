import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface BoardTemplatePolicy {
  locked: boolean;
  managementUrl: '/admin/boards';
}

export function useBoardTemplatePolicy(enabled: boolean) {
  return useQuery<BoardTemplatePolicy>({
    queryKey: ['/api/boards/template-policy'],
    queryFn: () => apiRequest('GET', '/api/boards/template-policy') as Promise<BoardTemplatePolicy>,
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
