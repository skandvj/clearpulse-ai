"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-[#f4efe8] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="h-[520px] w-full rounded-[28px] border border-[#e3d8ca] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)]" />
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4efe8] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.10),_transparent_28%),radial-gradient(circle_at_85%_16%,_rgba(16,185,129,0.08),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.18),_rgba(244,239,232,0.96))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <Card className="w-full rounded-[28px] border-[#e3d8ca] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="p-8">
            <div className="mb-8 flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight text-slate-950">
                    ClearPulse
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Sign In
                  </p>
                </div>
              </Link>
            </div>

            <div className="mb-8 space-y-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
                Access your workspace
              </h1>
              <p className="text-sm leading-6 text-slate-600">
                Sign in with Google or use your email and password.
              </p>
            </div>

            <Button
              variant="outline"
              className="h-11 w-full gap-3 border-[#ddd2c4] bg-white text-slate-800 hover:bg-slate-50"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || isSubmitting}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            <div className="relative my-7">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e7ddd1]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-[0.2em]">
                <span className="bg-white px-3 text-slate-400">
                  or continue with email
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-800">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="h-11 border-[#ddd2c4]"
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-red-500">{errors.email.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-800">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 border-[#ddd2c4]"
                  {...register("password")}
                />
                {errors.password ? (
                  <p className="text-xs text-red-500">{errors.password.message}</p>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                className="h-11 w-full bg-slate-950 text-white hover:bg-slate-800"
                disabled={isSubmitting || googleLoading}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
