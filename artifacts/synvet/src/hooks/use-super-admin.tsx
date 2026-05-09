import { useGetAdminMe, getGetAdminMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

export function useSuperAdmin() {
  const { user, loading: authLoading } = useAuth();
  const query = useGetAdminMe({
    query: {
      queryKey: getGetAdminMeQueryKey(),
      enabled: Boolean(user),
      retry: false,
      staleTime: 60_000,
    },
  });
  return {
    isSuperAdmin: query.isSuccess,
    isLoading: authLoading || (Boolean(user) && query.isLoading),
    admin: query.data ?? null,
  };
}
