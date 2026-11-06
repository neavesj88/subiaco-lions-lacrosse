import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock } from "lucide-react";
import { ADMIN_PATH } from "@/lib/admin-path";
import { useSiteText } from "@/hooks/use-site-text";

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type FormData = z.infer<typeof schema>;

// Simple Google "G" SVG icon
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function AdminLogin() {
  const t = useSiteText(); // club name shown under the "Admin Login" heading
  const [location, navigate] = useLocation();
  const { user, loginMutation } = useAuth();

  // Check if Google OAuth is available
  const { data: googleStatus } = useQuery<{ available: boolean }>({
    queryKey: ["/api/auth/google/available"],
    queryFn: () => apiRequest("GET", "/api/auth/google/available"),
  });

  // Read from the real address bar: wouter's location leaves the "?error=…"
  // part off, so this never noticed a failed Google sign-in.
  const googleError = new URLSearchParams(window.location.search).get("error") === "google";

  useEffect(() => {
    if (user) navigate(ADMIN_PATH);
  }, [user]);

  useEffect(() => {
    if (googleError) {
      toast({
        title: "Google Sign-In failed",
        description: "Your Google account isn't linked to an admin user. Contact your Super Admin.",
        variant: "destructive",
      });
    }
  }, [googleError]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    loginMutation.mutate(data, {
      onSuccess: () => navigate(ADMIN_PATH),
      onError: (e) => toast({ title: "Login failed", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12 bg-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-maroon-700 text-white flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Admin Login</h1>
          <p className="text-stone-500 text-sm mt-1">{t.clubFullName}</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Google Sign-In */}
            {googleStatus?.available && (
              <>
                <a href="/api/auth/google" className="block">
                  <Button type="button" variant="outline" className="w-full gap-2 border-stone-300">
                    <GoogleIcon />
                    Sign in with Google
                  </Button>
                </a>
                <div className="relative flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-stone-200" />
                  <span className="text-xs text-stone-500 font-medium">or</span>
                  <div className="flex-1 h-px bg-stone-200" />
                </div>
              </>
            )}

            {/* Username/password */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" autoComplete="username" {...register("username")} />
                {errors.username && <p className="text-xs text-red-600">{errors.username.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                <Lock className="h-4 w-4" />
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-stone-500 mt-4">
          Restricted access — club administrators only.
        </p>
      </div>
    </div>
  );
}
