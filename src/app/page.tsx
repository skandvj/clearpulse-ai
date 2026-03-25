import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4efe8] text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.25),_rgba(244,239,232,0.95))]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#f59e0b]/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#2563eb]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">
                ClearPulse
              </p>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Customer Intelligence
              </p>
            </div>
          </Link>

          <Button asChild className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800">
            <Link href="/login">Sign In</Link>
          </Button>
        </header>

        <section className="flex flex-1 items-center justify-center py-16">
          <div className="max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              ClearPulse
            </p>
            <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight text-slate-950 md:text-7xl">
              Account intelligence, kept simple.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
              One clean workspace for customer success teams to understand account
              health, evidence, and momentum.
            </p>

            <div className="mt-10 flex justify-center">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-slate-950 px-7 text-white hover:bg-slate-800"
              >
                <Link href="/login">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
