import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
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
import { getServerUser } from "@/lib/auth-helpers";
import { getAccountMeetingsForUser } from "@/lib/meetings";

interface MeetingsPageProps {
  params: { id: string };
}

function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export default async function MeetingsPage({ params }: MeetingsPageProps) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const account = await getAccountMeetingsForUser(params.id, user);

    if (!account) {
      notFound();
    }

    return (
      <PageWrapper>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_45%),linear-gradient(135deg,_#ffffff,_#f8fbff)] p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="w-fit px-0">
                <Link href={`/accounts/${params.id}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Account
                </Link>
              </Button>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Meeting Archive
              </div>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-950">
                {account.name} Meetings
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Review synced Fathom and meeting records, including summaries,
                participants, and recording links.
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Meeting Timeline
              </CardTitle>
              <CardDescription>
                {account.meetings.length} recorded meeting
                {account.meetings.length === 1 ? "" : "s"} for this account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {account.meetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <CalendarDays className="mb-3 h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    No meetings have been captured for this account yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {account.meetings.map((meeting) => (
                    <Card
                      key={meeting.id}
                      className="rounded-2xl border-slate-100 shadow-none"
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 text-blue-700"
                              >
                                {formatDate(meeting.meetingDate)}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                Updated {formatRelative(meeting.createdAt)}
                              </span>
                            </div>

                            <div>
                              <Link
                                href={`/accounts/${params.id}/meetings/${meeting.id}`}
                                className="text-lg font-semibold text-slate-900 hover:text-blue-600"
                              >
                                {meeting.title}
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
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
                              </div>
                            </div>

                            {meeting.summaryAI ? (
                              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                                {meeting.summaryAI.length > 220
                                  ? `${meeting.summaryAI.slice(0, 220)}...`
                                  : meeting.summaryAI}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-400">
                                No AI summary captured for this meeting yet.
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              {meeting.syncedToVitally ? (
                                <Badge variant="outline">Synced to Vitally</Badge>
                              ) : null}
                              {meeting.extractedKPIs ? (
                                <Badge variant="outline">KPIs Extracted</Badge>
                              ) : null}
                              {meeting.recordingUrl ? (
                                <a
                                  href={meeting.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Recording
                                </a>
                              ) : null}
                            </div>
                          </div>

                          <Button asChild variant="outline" size="sm">
                            <Link href={`/accounts/${params.id}/meetings/${meeting.id}`}>
                              Open Detail
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
