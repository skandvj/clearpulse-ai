"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  BarChart3,
  CircleGauge,
  Loader2,
  Sparkles,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const highlights = [
  {
    icon: Waves,
    title: "Unify account signals",
    description:
      "Bring meetings, tickets, notes, docs, and system events into one customer view.",
  },
  {
    icon: CircleGauge,
    title: "Explain health clearly",
    description:
      "Move from raw activity to KPI health, trend, and evidence-backed narrative in minutes.",
  },
  {
    icon: BarChart3,
    title: "Operate as a team",
    description:
      "Give CSMs, admins, and leadership one shared, current account story.",
  },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-[#f4efe8] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[32px] border border-white/70 bg-white/70 shadow-[0_24px_80px_rgba(15,23,42,0.12)]" />
        <div className="rounded-[32px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.12)]" />
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
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
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
    <div className="relative min-h-screen overflow-hidden bg-[#f4efe8] px-4 py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_30%),radial-gradient(circle_at_85%_18%,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.28),_rgba(244,239,232,0.95))]" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#2563eb]/10 blur-3xl" />
      <div className="absolute left-0 top-1/3 h-80 w-80 rounded-full bg-[#f59e0b]/10 blur-3xl" />

      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between rounded-[36px] border border-slate-200/70 bg-slate-950 p-8 text-white shadow-[0_32px_120px_rgba(15,23,42,0.24)] lg:p-10">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-lg font-semibold tracking-tight">
                    ClearPulse
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Customer Intelligence
                  </p>
                </div>
              </Link>

            </div>

            <div className="space-y-5">
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                The operating system for evidence-based customer success.
              </h1>
              <p className="max-w-xl text-base leading-8 text-slate-300 md:text-lg">
                ClearPulse is built for teams who need more than notes and dashboards.
                It turns customer signals into KPIs, health narratives, and account
                decisions that leadership can trust.
              </p>
            </div>

            <div className="grid gap-4">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-950">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-display text-xl font-semibold tracking-tight">
                          {item.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between rounded-[26px] border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300">
            <span>Every signal. Every account. One source of truth.</span>
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-medium text-white"
            >
              Learn more
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <Card className="w-full rounded-[36px] border-white/75 bg-white/88 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur">
            <CardContent className="p-8 md:p-10">
              <div className="mb-8 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Sign in
                </p>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-950">
                  Access your workspace
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  Use Google or your email and password to enter the ClearPulse workspace.
                </p>
              </div>

              <Button
                variant="outline"
                className="h-11 w-full gap-3 rounded-full border-slate-300 bg-white font-medium text-slate-800 hover:bg-slate-50"
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
                  <div className="w-full border-t border-slate-200" />
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
                    className="h-11 rounded-2xl border-slate-200 bg-white"
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
                    className="h-11 rounded-2xl border-slate-200 bg-white"
                    {...register("password")}
                  />
                  {errors.password ? (
                    <p className="text-xs text-red-500">
                      {errors.password.message}
                    </p>
                  ) : null}
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="h-11 w-full rounded-full bg-slate-950 text-white hover:bg-slate-800"
                  disabled={isSubmitting || googleLoading}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Sign in
                </Button>
              </form>

              <p className="mt-6 text-center text-xs leading-5 text-slate-500">
                Need access? Ask your workspace administrator to invite you into ClearPulse.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
