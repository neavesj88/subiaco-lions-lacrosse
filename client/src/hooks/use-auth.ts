import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type AuthUser = {
  id: number;
  name: string;
  role: "super_admin" | "club_admin" | "juniors_coordinator" | "content_manager";
  email: string;
  username: string;
};

const roleLevel: Record<AuthUser["role"], number> = {
  content_manager: 1,
  juniors_coordinator: 2,
  club_admin: 3,
  super_admin: 4,
};

export function useAuth() {
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").catch(() => null),
    staleTime: 5 * 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/login", creds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      qc.setQueryData(["/api/auth/me"], null);
      qc.clear();
    },
  });

  const hasRole = (...roles: AuthUser["role"][]) => {
    if (!user) return false;
    const userLevel = roleLevel[user.role];
    return roles.some((r) => userLevel >= roleLevel[r]);
  };

  return { user, isLoading, loginMutation, logoutMutation, hasRole };
}
