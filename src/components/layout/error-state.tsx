"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title: string;
  description: string;
  error?: Error & { digest?: string };
  retryLabel?: string;
  onRetry?: () => void;
  homeHref?: string;
  homeLabel?: string;
  fullscreen?: boolean;
}

export function ErrorState({
  title,
  description,
  error,
  retryLabel = "Try Again",
  onRetry,
  homeHref = "/",
  homeLabel = "Go Back",
  fullscreen = false,
}: ErrorStateProps) {
  const showDetails = process.env.NODE_ENV !== "production" && error?.message;

  return (
    <div
      className={[
        "flex items-center justify-center",
        fullscreen ? "min-h-screen bg-[#F7F8FA] px-6 py-10" : "min-h-[60vh]",
      ].join(" ")}
    >
      <Card className="w-full max-w-2xl rounded-[28px] border-gray-200 bg-white shadow-xl shadow-slate-200/60">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <CardTitle className="font-display text-3xl tracking-tight text-slate-950">
              {title}
            </CardTitle>
            <CardDescription className="max-w-xl text-sm leading-6 text-slate-600">
              {description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-3">
            {onRetry ? (
              <Button
                className="gap-2 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                onClick={onRetry}
              >
                <RotateCcw className="h-4 w-4" />
                {retryLabel}
              </Button>
            ) : null}

            <Button
              asChild
              variant="outline"
              className="gap-2 rounded-xl border-slate-200 px-5 text-slate-700 hover:bg-slate-50"
            >
              <Link href={homeHref}>
                {homeLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {showDetails ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                Debug Details
              </p>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-red-900">
                {error.message}
              </pre>
              {error.digest ? (
                <p className="mt-3 font-mono text-[11px] text-red-700">
                  Digest: {error.digest}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
