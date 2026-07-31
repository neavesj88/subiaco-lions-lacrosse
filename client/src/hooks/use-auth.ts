import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { roleHas, type Permission, type Role } from "@shared/roles";

export type AuthUser = {
  id: number;
  name: string;
  role: Role;
  email: string;
  username: string;
  usingDefaultPassword?: boolean;
};

// Legacy ladder — kept only for the older hasRole() helper. New code should
// use can(), which also handles restricted roles like social_media.
const roleLevel: Record<Role, number> = {
  social_media: 1,
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

  // can("events") — the preferred check. Mirrors the server's requirePermission,
  // both reading shared/roles.ts, so the tabs shown always match what's allowed.
  const can = (permission: Permission) => !!user && roleHas(user.role, permission);

  return { user, isLoading, loginMutation, logoutMutation, hasRole, can };
}
