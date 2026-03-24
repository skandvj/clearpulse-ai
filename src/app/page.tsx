import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CircleDashed,
  FileText,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const featureCards = [
  {
    icon: Waves,
    title: "Signal Ingestion",
    description:
      "Pull account evidence from Slack, Fathom, Vitally, Jira, Personas, meetings, docs, and more into one normalized signal layer.",
  },
  {
    icon: Bot,
    title: "AI KPI Extraction",
    description:
      "Turn raw customer signals into measurable KPIs, linked evidence, and account context your team can actually act on.",
  },
  {
    icon: BarChart3,
    title: "Health Intelligence",
    description:
      "Score KPI health with evidence-backed narratives, trends, and portfolio views built for CS leaders and account owners.",
  },
  {
    icon: FileText,
    title: "Leadership Reporting",
    description:
      "Generate account reports, push health context into Vitally, and keep success plans current without manual copy-paste.",
  },
];

const productStats = [
  { label: "Sources unified", value: "9" },
  { label: "Account view", value: "1" },
  { label: "Health model", value: "AI + evidence" },
  { label: "Audience", value: "CSMs to execs" },
];

const workflow = [
  "Connect customer signals from meetings, tickets, docs, notes, and system activity.",
  "Normalize every event into one evidence layer before extraction or scoring happens.",
  "Extract KPIs, score health, explain risk, and surface the latest account reality in one workspace.",
];

export default async function Home() {
  const session = await auth();
  const primaryHref = session?.user ? "/dashboard" : "/login";
  const primaryLabel = session?.user ? "Open Dashboard" : "Start with ClearPulse";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4efe8] text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.25),_rgba(244,239,232,0.95))]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#f59e0b]/10 blur-3xl" />
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#2563eb]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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
          </div>

          <nav className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost" className="rounded-full px-4 text-slate-700">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
            >
              <Link href={primaryHref}>{primaryLabel}</Link>
            </Button>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div className="space-y-8">
            <Badge className="rounded-full border border-slate-300 bg-white/80 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 shadow-sm hover:bg-white">
              Every signal. Every account. One source of truth.
            </Badge>

            <div className="space-y-6">
              <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-tight text-slate-950 md:text-6xl xl:text-7xl">
                Turn scattered customer signals into one decision-ready success platform.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 md:text-xl">
                ClearPulse helps customer success teams ingest account evidence,
                extract KPIs with AI, score health with narrative context, and
                deliver a leadership-ready account view without spreadsheet
                archaeology.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-slate-950 px-7 text-white hover:bg-slate-800"
              >
                <Link href={primaryHref}>
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-slate-300 bg-white/70 px-7 text-slate-800 hover:bg-white"
              >
                <Link href="/admin/integrations">Explore Integrations</Link>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {productStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[26px] border border-white/70 bg-white/70 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-4 top-6 h-24 w-24 rounded-full border border-slate-300/60 bg-white/40 backdrop-blur-sm" />
            <div className="absolute -left-8 bottom-14 h-28 w-28 rounded-full bg-[#10b981]/10 blur-2xl" />

            <div className="rounded-[32px] border border-slate-200/80 bg-white/85 p-6 shadow-[0_28px_90px_rgba(15,23,42,0.14)] backdrop-blur">
              <div className="rounded-[28px] bg-slate-950 p-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Account Intelligence
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                      One workspace for CS, ops, and leadership
                    </h2>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                    <CircleDashed className="h-6 w-6 text-emerald-300" />
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {workflow.map((step, index) => (
                    <div
                      key={step}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-950">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-200">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {featureCards.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-[26px] border border-slate-200 bg-[#fcfbf8] p-5"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-slate-950">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200/80 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight text-slate-950">
                Built for modern customer success teams
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Use ClearPulse to unify post-sale signals, surface measurable
                account progress, and give every stakeholder the same account truth.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <ShieldCheck className="h-4 w-4" />
              RBAC, evidence-backed AI, browser-managed integrations, and leadership reports
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
