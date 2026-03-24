import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  PlayCircle,
  Users,
} from "lucide-react";
import { PageWrapper } from "@/components/layout/page-wrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HealthStatusBadge } from "@/components/ui/health-badge";
import { getServerUser } from "@/lib/auth-helpers";
import { getMeetingDetailForUser } from "@/lib/meetings";

interface MeetingDetailPageProps {
  params: { id: string; meetingId: string };
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return [hrs, mins, secs]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  return [mins, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

function buildRecordingTimestampUrl(recordingUrl: string, timestamp: number): string {
  return `${recordingUrl}#t=${timestamp}`;
}

export default async function MeetingDetailPage({
  params,
}: MeetingDetailPageProps) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const detail = await getMeetingDetailForUser(
      params.id,
      params.meetingId,
      user
    );

    if (!detail) {
      notFound();
    }

    const { account, meeting, meetingKpis } = detail;
    const transcript = meeting.transcriptRaw?.trim();

    return (
      <PageWrapper>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="px-0">
              <Link href={`/accounts/${params.id}/meetings`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Meetings
              </Link>
            </Button>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_45%),linear-gradient(135deg,_#ffffff,_#f8fbff)] p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Meeting Detail
                </div>
                <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950">
                  {meeting.title}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {account.name} · {formatDate(meeting.meetingDate)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  {meeting.duration != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {meeting.duration} min
                    </span>
                  ) : null}
                  {meeting.participants.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {meeting.participants.length} participant
                      {meeting.participants.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {meeting.recordingUrl ? (
                    <a
                      href={meeting.recordingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Recording
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {meeting.syncedToVitally ? (
                  <Badge variant="outline">Synced to Vitally</Badge>
                ) : null}
                {meeting.extractedKPIs ? (
                  <Badge variant="outline">KPIs Extracted</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    AI Summary
                  </CardTitle>
                  <CardDescription>
                    Synthesized summary captured from the meeting source.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {meeting.summaryAI?.trim() ||
                      "No AI summary is available for this meeting yet."}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Transcript
                  </CardTitle>
                  <CardDescription>
                    Full transcript or notes captured for this meeting.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {transcript ||
                        "No transcript has been stored for this meeting yet."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Participants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {meeting.participants.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No participant list was stored for this meeting.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {meeting.participants.map((participant) => (
                        <div
                          key={participant}
                          className="rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-600"
                        >
                          {participant}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Meeting KPIs
                  </CardTitle>
                  <CardDescription>
                    KPIs extracted from evidence linked to this meeting. Video
                    moments appear when a timestamp or clip is available.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {meetingKpis.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No KPIs have been linked to this meeting yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {meetingKpis.map((kpi) => {
                        const videoHref =
                          kpi.videoClipUrl ||
                          (meeting.recordingUrl && kpi.videoTimestamp != null
                            ? buildRecordingTimestampUrl(
                                meeting.recordingUrl,
                                kpi.videoTimestamp
                              )
                            : null);

                        return (
                          <div
                            key={kpi.id}
                            className="rounded-2xl border border-slate-100 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900">
                                  {kpi.metricName}
                                </p>
                                <div className="mt-2">
                                  <HealthStatusBadge status={kpi.healthStatus} />
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-slate-900">
                                {kpi.healthScore == null ? "—" : `${Math.round(kpi.healthScore)}/100`}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {kpi.videoTimestamp != null ? (
                                <Badge variant="outline">
                                  Timestamp {formatTimestamp(kpi.videoTimestamp)}
                                </Badge>
                              ) : null}
                              {videoHref ? (
                                <a
                                  href={videoHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                  <PlayCircle className="h-4 w-4" />
                                  Open Moment
                                </a>
                              ) : (
                                <span className="text-sm text-slate-400">
                                  No video moment stored yet
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">
                    Account Context
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link href={`/accounts/${params.id}`}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Open Account Overview
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      redirect("/accounts");
    }

    throw error;
  }
}
