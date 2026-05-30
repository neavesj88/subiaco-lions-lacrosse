import { useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock } from "lucide-react";

const schema = z.object({
  username: z.string().min(1, "Required"),
  password: z.string().min(1, "Required"),
});

type FormData = z.infer<typeof schema>;

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { user, loginMutation } = useAuth();

  useEffect(() => {
    if (user) navigate("/admin");
  }, [user]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    loginMutation.mutate(data, {
      onSuccess: () => navigate("/admin"),
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
          <p className="text-stone-500 text-sm mt-1">Subiaco Lions Lacrosse Club</p>
        </div>

        <Card>
          <CardContent className="pt-6">
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

        <p className="text-center text-xs text-stone-400 mt-4">
          Restricted access — club administrators only.
        </p>
      </div>
    </div>
  );
}
