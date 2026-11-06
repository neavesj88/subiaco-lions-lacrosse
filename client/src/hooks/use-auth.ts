import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";

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

  // Only the server actually saying "not logged in" (401) counts as logged
  // out. A dropped Wi-Fi connection or a server restart is an ERROR, which
  // keeps the account already known: treating it as "logged out" sent the
  // admin to the login page and threw away whatever they were writing.
  const { data: user, isLoading, isError } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: () => apiRequest("GET", "/api/auth/me").catch((err) => {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }),
    staleTime: 5 * 60_000,
    retry: 2,
  });

  const loginMutation = useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/login", creds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/auth/me"] }),
    // The login page shows its own "Login failed" message; without this the
    // app-wide "That didn't save" message appeared as well.
    onError: () => {},
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onError: (e: Error) => toast({ title: "Couldn't sign out", description: e.message, variant: "destructive" }),
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

  return { user, isLoading, isError, loginMutation, logoutMutation, hasRole, can };
}
