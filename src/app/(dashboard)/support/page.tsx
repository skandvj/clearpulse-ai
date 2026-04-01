import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const workflowSteps = [
  {
    title: "1. Connect sources",
    body: "Admins connect source APIs and AI providers in Integrations. ClearPulse stores those credentials server-side and uses them only from the backend.",
  },
  {
    title: "2. Sync account signals",
    body: "A sync pulls customer activity into ClearPulse as raw signals. Signals can come from meetings, Slack, CRM notes, tickets, docs, and other connected systems.",
  },
  {
    title: "3. Extract KPIs",
    body: "ClearPulse sends normalized signal text to the configured AI provider and asks it to return measurable KPIs plus evidence links back to the exact signals.",
  },
  {
    title: "4. Score health",
    body: "Each KPI is scored using its linked evidence and recent account context. The system produces a score, trend, and short narrative explaining what is going well or what looks risky.",
  },
  {
    title: "5. Review and share",
    body: "Teams review account pages, meeting history, signals, the dashboard, and the generated PDF report. If Vitally is connected, KPI updates can also be pushed back there.",
  },
];

const pageGuide = [
  {
    title: "Dashboard",
    body: "Portfolio view for leadership. Use it to see account health distribution, recent activity, and which accounts need attention.",
  },
  {
    title: "Accounts",
    body: "The main working area for CSMs and admins. Each account shows current state, KPIs, contacts, meetings, and raw evidence.",
  },
  {
    title: "Signals",
    body: "The raw material behind the AI. If something looks wrong in KPI extraction or scoring, this is the first place to check.",
  },
  {
    title: "Admin > Integrations",
    body: "Where admins connect source APIs, AI providers, and test configuration status.",
  },
  {
    title: "Admin > Sync",
    body: "Where admins or operators run syncs and inspect job history, failures, and completion status.",
  },
];

const sourceNotes = [
  "Fathom links meetings to existing ClearPulse accounts by attendee email or attendee domain.",
  "Slack links messages by account channel naming and domain mentions.",
  "Vitally brings in notes and traits and can also receive KPI pushes back from ClearPulse.",
  "AI scoring depends on the synced evidence that exists today. If a source has not synced recently, the score can lag behind reality.",
];

const freshnessNotes = [
  "Account pages show the latest account-level sync time.",
  "Sync jobs show when a source last ran and whether it succeeded or failed.",
  "Health scoring uses the latest KPI evidence plus recent account signals, especially the last 30 days of context.",
  "If you want the freshest answer, rerun Sync, then Extract KPIs, then Re-score Health.",
];

const troubleshootingNotes = [
  "If meetings appear but KPIs do not, check that the AI provider is configured and that extraction completed successfully.",
  "If a source says connected but no data appears, check matching rules first. For example, Fathom depends on attendee email or domain matching an existing account.",
  "If health scoring looks incomplete, check whether the KPI has evidence. Scores are strongest when the KPI has direct linked signals.",
  "If a report looks outdated, rerun sync and health scoring before generating a new PDF.",
];

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Support
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Simple guidance for using ClearPulse, understanding what the AI is
            doing behind the scenes, and explaining the product to both technical
            and non-technical teammates.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/integrations">Open Integrations</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/sync">Open Sync Console</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>What ClearPulse Does</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              ClearPulse brings customer signals from different tools into one
              account workspace, then uses AI to extract measurable KPIs and
              explain account health in a way leadership and customer teams can
              actually use.
            </p>
            <p>
              Think of it as an account intelligence layer: it does not replace
              your source systems, it helps teams make sense of them in one
              place.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>How Recent Is The Data?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            {freshnessNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle>How The Workflow Works</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflowSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <h2 className="text-sm font-semibold text-slate-950">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {step.body}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>What Happens Behind The Scenes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              Every source first becomes a normalized signal. That means ClearPulse
              converts transcripts, notes, messages, and other raw text into a
              consistent internal format before AI is asked to interpret it.
            </p>
            <p>
              KPI extraction does not read the original product UI. It reads the
              normalized signal text, asks the AI for structured KPI JSON, and then
              links each KPI back to the signals that support it.
            </p>
            <p>
              Health scoring then looks at those evidence signals plus recent
              account activity to explain why a KPI looks healthy, stable, or at
              risk.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>Page Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            {pageGuide.map((item) => (
              <div key={item.title}>
                <p className="font-medium text-slate-950">{item.title}</p>
                <p className="text-slate-600">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>Source Logic In Plain Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            {sourceNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-slate-700">
            {troubleshootingNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
