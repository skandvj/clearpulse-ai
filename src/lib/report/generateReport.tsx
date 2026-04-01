import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  AccountReportContact,
  AccountReportData,
  AccountReportKpi,
  AccountReportMeeting,
} from "./load-account-report-data";

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingHorizontal: 36,
    paddingBottom: 42,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  coverPage: {
    paddingTop: 54,
    paddingHorizontal: 42,
    paddingBottom: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0F172A",
    backgroundColor: "#F8FBFF",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  coverTitle: {
    marginTop: 24,
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
  },
  coverSubtitle: {
    marginTop: 10,
    fontSize: 13,
    color: "#475569",
  },
  coverGrid: {
    marginTop: 28,
    flexDirection: "row",
    gap: 16,
  },
  coverCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  coverLabel: {
    fontSize: 9,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  coverValue: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  pageEyebrow: {
    fontSize: 9,
    textTransform: "uppercase",
    color: "#2563EB",
    letterSpacing: 1,
    fontFamily: "Helvetica-Bold",
  },
  pageTitle: {
    marginTop: 6,
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.2,
  },
  pageDescription: {
    marginTop: 4,
    fontSize: 10,
    color: "#64748B",
    lineHeight: 1.5,
  },
  healthChip: {
    minWidth: 74,
    minHeight: 74,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  healthScore: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
  },
  healthStatus: {
    marginTop: 2,
    fontSize: 8,
    textTransform: "uppercase",
    color: "#475569",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  section: {
    marginTop: 22,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 10,
    lineHeight: 1.6,
    color: "#334155",
  },
  summaryGrid: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  summaryLabel: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#64748B",
    fontFamily: "Helvetica-Bold",
  },
  summaryValue: {
    marginTop: 5,
    fontSize: 11,
    color: "#0F172A",
    fontFamily: "Helvetica-Bold",
  },
  list: {
    marginTop: 6,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  listBullet: {
    width: 12,
    fontSize: 10,
    color: "#2563EB",
    fontFamily: "Helvetica-Bold",
  },
  listText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.55,
    color: "#334155",
  },
  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
  },
  headerCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontFamily: "Helvetica-Bold",
    color: "#1E3A8A",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 9,
    lineHeight: 1.4,
    color: "#334155",
  },
  metricCell: {
    width: "20%",
  },
  targetCell: {
    width: "12%",
  },
  currentCell: {
    width: "14%",
  },
  healthCell: {
    width: "12%",
  },
  narrativeCell: {
    width: "28%",
  },
  sourcesCell: {
    width: "14%",
  },
  metricName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
    marginBottom: 3,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  sourcePill: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginRight: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 7.5,
    color: "#0F172A",
  },
  sourceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sourceFootnote: {
    marginTop: 5,
    fontSize: 7.5,
    color: "#64748B",
    lineHeight: 1.4,
  },
  contactGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  contactCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  contactName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },
  contactMeta: {
    marginTop: 4,
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.45,
  },
  primaryTag: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  meetingStack: {
    marginTop: 14,
  },
  meetingCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  meetingTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#0F172A",
  },
  meetingMeta: {
    marginTop: 4,
    fontSize: 9,
    color: "#475569",
    lineHeight: 1.45,
  },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    fontSize: 8,
    color: "#64748B",
  },
});

function getHealthColor(score: number | null, status: string): string {
  if (score != null) {
    if (score >= 70) return "#10B981";
    if (score >= 40) return "#F59E0B";
    return "#EF4444";
  }

  if (status === "HEALTHY") return "#10B981";
  if (status === "AT_RISK") return "#F59E0B";
  if (status === "CRITICAL") return "#EF4444";
  return "#94A3B8";
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatReportDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatKpiValue(value: string | null, unit: string | null): string {
  if (!value) return "—";
  return [value, unit].filter(Boolean).join(" ");
}

function splitTextList(value: string | null): string[] {
  if (!value) return [];

  return value
    .split(/\n+/)
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function sourceLabel(source: string): string {
  return source
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceColor(source: string): string {
  switch (source) {
    case "SLACK":
      return "#E9D5FF";
    case "FATHOM":
      return "#FED7AA";
    case "AM_MEETING":
      return "#E9D5FF";
    case "VITALLY":
      return "#DDD6FE";
    case "SALESFORCE":
      return "#BFDBFE";
    case "PERSONAS":
      return "#A7F3D0";
    case "SHAREPOINT":
      return "#BAE6FD";
    case "JIRA":
      return "#BFDBFE";
    case "GOOGLE_DRIVE":
      return "#BFDBFE";
    default:
      return "#E2E8F0";
  }
}

function renderFallbackText(value: string | null, fallback: string) {
  return value?.trim() ? value.trim() : fallback;
}

function HealthChip({
  score,
  status,
}: {
  score: number | null;
  status: string;
}) {
  const color = getHealthColor(score, status);

  return (
    <View style={[styles.healthChip, { borderColor: color }]}>
      <Text style={[styles.healthScore, { color }]}>
        {score == null ? "—" : String(score)}
      </Text>
      <Text style={styles.healthStatus}>{statusLabel(status)}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>ClearPulse CSM Account Overview</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

function ReportList({
  items,
  fallback,
}: {
  items: string[];
  fallback: string;
}) {
  const rows = items.length > 0 ? items : [fallback];

  return (
    <View style={styles.list}>
      {rows.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={styles.listBullet}>•</Text>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function KpiRow({ kpi }: { kpi: AccountReportKpi }) {
  const statusColor = getHealthColor(kpi.healthScore, kpi.healthStatus);

  return (
    <View style={styles.row}>
      <View style={[styles.cell, styles.metricCell]}>
        <Text style={styles.metricName}>{kpi.metricName}</Text>
        <Text>Updated {formatDate(kpi.updatedAt)}</Text>
      </View>
      <View style={[styles.cell, styles.targetCell]}>
        <Text>{formatKpiValue(kpi.targetValue, kpi.unit)}</Text>
      </View>
      <View style={[styles.cell, styles.currentCell]}>
        <Text>{formatKpiValue(kpi.currentValue, kpi.unit)}</Text>
      </View>
      <View style={[styles.cell, styles.healthCell]}>
        <Text style={{ fontFamily: "Helvetica-Bold", color: statusColor }}>
          {kpi.healthScore == null ? "—" : `${kpi.healthScore}/100`}
        </Text>
        <Text
          style={[
            styles.statusPill,
            {
              color: statusColor,
              backgroundColor: `${statusColor}22`,
            },
          ]}
        >
          {statusLabel(kpi.healthStatus)}
        </Text>
      </View>
      <View style={[styles.cell, styles.narrativeCell]}>
        <Text>
          {renderFallbackText(
            kpi.healthNarrative,
            "Health scoring has not been generated for this KPI yet."
          )}
        </Text>
      </View>
      <View style={[styles.cell, styles.sourcesCell]}>
        <View style={styles.sourceWrap}>
          {kpi.evidenceSources.length > 0 ? (
            kpi.evidenceSources.map((source) => (
              <Text
                key={`${kpi.id}-${source}`}
                style={[
                  styles.sourcePill,
                  { backgroundColor: sourceColor(source) },
                ]}
              >
                {sourceLabel(source)}
              </Text>
            ))
          ) : (
            <Text>—</Text>
          )}
        </View>
        <Text style={styles.sourceFootnote}>
          Evidence from {kpi.evidenceCount} source{kpi.evidenceCount === 1 ? "" : "s"}.
        </Text>
        {kpi.hasPriorityNoteEvidence ? (
          <Text style={styles.sourceFootnote}>
            Account team notes influenced this score.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ContactCard({ contact }: { contact: AccountReportContact }) {
  return (
    <View style={styles.contactCard}>
      <Text style={styles.contactName}>{contact.name}</Text>
      <Text style={styles.contactMeta}>{contact.role ?? "Role not captured"}</Text>
      <Text style={styles.contactMeta}>{contact.email ?? "Email not captured"}</Text>
      {contact.isPrimary ? <Text style={styles.primaryTag}>Primary Contact</Text> : null}
    </View>
  );
}

function MeetingCard({ meeting }: { meeting: AccountReportMeeting }) {
  return (
    <View style={styles.meetingCard}>
      <Text style={styles.meetingTitle}>{meeting.title}</Text>
      <Text style={styles.meetingMeta}>{formatDate(meeting.meetingDate)}</Text>
      <Text style={styles.meetingMeta}>
        {meeting.participants.length > 0
          ? meeting.participants.join(", ")
          : "Participants not captured"}
      </Text>
      <Text style={styles.meetingMeta}>
        {renderFallbackText(
          meeting.summaryAI,
          "No AI summary has been stored for this meeting yet."
        )}
      </Text>
      {meeting.hasRecording ? (
        <Text style={styles.primaryTag}>Recording Available</Text>
      ) : null}
    </View>
  );
}

function ClearPulseAccountReport({ data }: { data: AccountReportData }) {
  const businessGoals = splitTextList(data.account.businessGoals);
  const objectives = splitTextList(data.account.objectives);
  const implementationPriorities = splitTextList(data.account.implementationPlan);
  const roadblocks = splitTextList(data.account.roadblocks);
  const healthColor = getHealthColor(
    data.account.healthScore,
    data.account.healthStatus
  );

  return (
    <Document title={`${data.account.name} CSM Account Overview`}>
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.badge}>ClearPulse Report</Text>
        <Text style={styles.coverTitle}>{data.account.name}</Text>
        <Text style={styles.coverSubtitle}>CSM Account Overview</Text>

        <View style={styles.coverGrid}>
          <View style={styles.coverCard}>
            <Text style={styles.coverLabel}>Prepared By</Text>
            <Text style={styles.coverValue}>
              {data.account.csm?.name ?? data.preparedBy}
            </Text>
          </View>
          <View style={styles.coverCard}>
            <Text style={styles.coverLabel}>Report Date</Text>
            <Text style={styles.coverValue}>{formatReportDate(data.generatedAt)}</Text>
          </View>
          <View style={styles.coverCard}>
            <Text style={styles.coverLabel}>Health Status</Text>
            <Text style={[styles.coverValue, { color: healthColor }]}>
              {statusLabel(data.account.healthStatus)}
            </Text>
          </View>
          <View style={styles.coverCard}>
            <Text style={styles.coverLabel}>KPIs Tracked</Text>
            <Text style={styles.coverValue}>{String(data.kpis.length)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Snapshot</Text>
          <Text style={styles.sectionBody}>
            This overview reflects the latest synced account data available in
            ClearPulse as of {formatDate(data.account.lastSyncedAt)}. It includes
            current account context, KPI health, implementation priorities, and
            recent customer meeting context.
          </Text>
        </View>

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageEyebrow}>Page 1</Text>
            <Text style={styles.pageTitle}>Account Summary</Text>
            <Text style={styles.pageDescription}>Current account context.</Text>
          </View>
          <HealthChip
            score={data.account.healthScore}
            status={data.account.healthStatus}
          />
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tier</Text>
            <Text style={styles.summaryValue}>
              {data.account.tierLabel ?? "Not set"}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>CSM</Text>
            <Text style={styles.summaryValue}>
              {data.account.csm?.name ?? data.preparedBy}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Domain</Text>
            <Text style={styles.summaryValue}>
              {data.account.domain ?? "Not captured"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Agreement / Solution Summary</Text>
          <Text style={styles.sectionBody}>
            {renderFallbackText(
              data.account.currentSolution,
              "No solution summary has been captured for this account yet."
            )}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current State</Text>
          <Text style={styles.sectionBody}>
            {renderFallbackText(
              data.account.currentState,
              "No current-state narrative has been captured for this account yet."
            )}
          </Text>
        </View>

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.pageEyebrow}>Page 2</Text>
        <Text style={styles.pageTitle}>Goals & Objectives</Text>
        <Text style={styles.pageDescription}>Business goals and success measures.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Goals</Text>
          <ReportList
            items={businessGoals}
            fallback="No business goals have been documented yet."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objectives</Text>
          <ReportList
            items={objectives}
            fallback="No objectives have been documented yet."
          />
        </View>

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageEyebrow}>Page 3</Text>
        <Text style={styles.pageTitle}>KPIs / Measures of Success</Text>
        <Text style={styles.pageDescription}>Evidence-backed KPI health.</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.metricCell]}>KPI / Metric</Text>
            <Text style={[styles.headerCell, styles.targetCell]}>Target</Text>
            <Text style={[styles.headerCell, styles.currentCell]}>Current</Text>
            <Text style={[styles.headerCell, styles.healthCell]}>Health</Text>
            <Text style={[styles.headerCell, styles.narrativeCell]}>Health Narrative</Text>
            <Text style={[styles.headerCell, styles.sourcesCell]}>Sources</Text>
          </View>
          {data.kpis.length > 0 ? (
            data.kpis.map((kpi) => <KpiRow key={kpi.id} kpi={kpi} />)
          ) : (
            <View style={styles.row}>
              <Text style={styles.cell}>
                No KPIs have been captured for this account yet.
              </Text>
            </View>
          )}
        </View>

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.pageEyebrow}>Page 4</Text>
        <Text style={styles.pageTitle}>Go-Forward Program</Text>
        <Text style={styles.pageDescription}>Implementation priorities and blockers.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Implementation Priorities</Text>
          <ReportList
            items={implementationPriorities}
            fallback="No implementation priorities have been captured yet."
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Roadblocks</Text>
          <ReportList
            items={roadblocks}
            fallback="No current roadblocks have been captured yet."
          />
        </View>

        <PageFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.pageEyebrow}>Page 5</Text>
        <Text style={styles.pageTitle}>Contacts & Meeting Context</Text>
        <Text style={styles.pageDescription}>Who is involved and what was discussed recently.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Contacts</Text>
        </View>
        <View style={styles.contactGrid}>
          {data.contacts.length > 0 ? (
            data.contacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))
          ) : (
            <Text style={styles.sectionBody}>
              No contacts have been added for this account yet.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Meetings</Text>
        </View>
        <View style={styles.meetingStack}>
          {data.meetings.length > 0 ? (
            data.meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))
          ) : (
            <Text style={styles.sectionBody}>
              No meetings have been captured for this account yet.
            </Text>
          )}
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}

export async function renderAccountReportToBuffer(
  data: AccountReportData
): Promise<Buffer> {
  return renderToBuffer(<ClearPulseAccountReport data={data} />);
}

export { ClearPulseAccountReport };
