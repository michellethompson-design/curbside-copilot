import type { ExportRow } from "./compliance";

// Jurisdiction export presets (P2). A preset is configuration over the one
// normalized row shape: which columns, what they're called, how dates and
// numbers are formatted, what the file is named. Adding a jurisdiction is
// adding a preset object — never a bespoke exporter. Formats are shaped like
// the states' uploads and clearly MOCKED until validated against the real
// current templates.

type Formats = { date: (d: Date) => string; units: (n: number) => string };

export interface ExportPreset {
  id: string;
  name: string;
  jurisdiction: string;
  note: string;
  filename: (orgName: string, date: string) => string;
  formats: Formats;
  columns: { header: string; value: (r: ExportRow, f: Formats) => string }[];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const us = (d: Date) => {
  const x = d.toISOString().slice(0, 10).split("-");
  return `${x[1]}/${x[2]}/${x[0]}`;
};
const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const PRESETS: ExportPreset[] = [
  {
    id: "generic-mvar",
    name: "Generic — Minimum Viable Audit Record",
    jurisdiction: "Any",
    note: "Universal certificate floor; the default when a state has no published format.",
    filename: (org, date) => `PD_Audit_Export_${slug(org)}_${date}.csv`,
    formats: { date: iso, units: (n) => n.toFixed(2) },
    columns: [
      { header: "ParticipantLegalName", value: (r) => `${r.firstName} ${r.lastName}` },
      { header: "StateEducatorID", value: (r) => r.licenseId },
      { header: "EventTitle", value: (r) => r.program },
      { header: "CompletionDate", value: (r, f) => f.date(r.endDate) },
      { header: "CreditCategory", value: (r) => r.creditTypeName },
      { header: "UnitsEarned", value: (r, f) => f.units(r.units) },
      { header: "VerificationMethod", value: (r) => r.verificationMethod },
      { header: "UCID", value: (r) => r.ucid },
      { header: "AuthorizedProvider", value: (r) => r.provider },
    ],
  },
  {
    id: "pa-perms",
    name: "Pennsylvania — Act 48 / PERMS upload",
    jurisdiction: "PA",
    note: "Shaped like a PERMS professional-education upload (format mocked for the prototype).",
    filename: (org, date) => `act48-perms-upload-${date}.csv`,
    formats: { date: iso, units: (n) => n.toFixed(2) },
    columns: [
      { header: "ProfessionalPersonnelID", value: (r) => r.licenseId },
      { header: "LastName", value: (r) => r.lastName },
      { header: "FirstName", value: (r) => r.firstName },
      { header: "ProviderName", value: (r) => r.provider },
      { header: "ProgramName", value: (r) => r.program },
      { header: "ProgramStartDate", value: (r, f) => f.date(r.startDate) },
      { header: "ProgramEndDate", value: (r, f) => f.date(r.endDate) },
      { header: "CreditType", value: (r) => r.creditTypeName },
      { header: "HoursEarned", value: (r, f) => f.units(r.units) },
    ],
  },
  {
    id: "tx-tea",
    name: "Texas — TEA CPE audit bundle",
    jurisdiction: "TX",
    note: "Adds certificate class, per-program topic, and a five-year evidence-retention column (mocked).",
    filename: (org, date) => `TEA_CPE_Export_${slug(org)}_${date}.csv`,
    formats: { date: us, units: (n) => n.toFixed(2) },
    columns: [
      { header: "EducatorName", value: (r) => `${r.lastName}, ${r.firstName}` },
      { header: "TEA_ID", value: (r) => r.licenseId },
      { header: "CertificateClass", value: () => "Teacher" },
      { header: "TopicName", value: (r) => r.program },
      { header: "CPEHours", value: (r, f) => f.units(r.units) },
      { header: "CompletionDate", value: (r, f) => f.date(r.endDate) },
      { header: "ProviderName", value: (r) => r.provider },
      {
        header: "EvidenceRetainUntil",
        value: (r, f) => f.date(new Date(r.endDate.getTime() + 5 * 365.25 * 24 * 3600 * 1000)),
      },
      { header: "UCID", value: (r) => r.ucid },
    ],
  },
  {
    id: "ca-mvar",
    name: "California — MVAR default",
    jurisdiction: "CA",
    note: "California publishes no upload format; the MVAR floor applies (graceful degradation).",
    filename: (org, date) => `CA_PD_Export_${slug(org)}_${date}.csv`,
    formats: { date: iso, units: (n) => n.toFixed(2) },
    columns: [
      { header: "ParticipantLegalName", value: (r) => `${r.firstName} ${r.lastName}` },
      { header: "EducatorID", value: (r) => r.licenseId },
      { header: "EventTitle", value: (r) => r.program },
      { header: "CompletionDate", value: (r, f) => f.date(r.endDate) },
      { header: "CreditCategory", value: (r) => r.creditTypeName },
      { header: "UnitsEarned", value: (r, f) => f.units(r.units) },
      { header: "UCID", value: (r) => r.ucid },
    ],
  },
];

export function getPreset(id: string | null | undefined): ExportPreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS.find((p) => p.id === "pa-perms")!;
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function renderCsv(preset: ExportPreset, rows: ExportRow[]): string {
  const lines = [
    preset.columns.map((c) => c.header).join(","),
    ...rows.map((r) => preset.columns.map((c) => esc(c.value(r, preset.formats))).join(",")),
  ];
  return lines.join("\r\n") + "\r\n";
}
