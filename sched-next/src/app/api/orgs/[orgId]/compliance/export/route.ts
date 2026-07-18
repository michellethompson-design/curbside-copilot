import { invalidDateParam, parseDateParam } from "@/lib/dates";
import { buildExportRows } from "@/lib/compliance";
import { getPreset, renderCsv } from "@/lib/presets";

// Registry-shaped exports, one per jurisdiction preset (see src/lib/presets.ts).
// Formats mirror the states' uploads and are MOCKED until validated against
// the real current templates — the scene's claim is "the export matches what
// Dana reports," not "we are state-certified."
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const creditTypeId = url.searchParams.get("creditTypeId");
  if (!creditTypeId) return new Response("creditTypeId required", { status: 400 });
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (invalidDateParam(from) || invalidDateParam(to)) {
    return new Response("from/to must be ISO dates, e.g. 2026-07-01", { status: 400 });
  }
  const preset = getPreset(url.searchParams.get("preset"));

  const data = await buildExportRows(
    orgId,
    creditTypeId,
    parseDateParam(from),
    parseDateParam(to),
  );
  if (!data) return new Response("Not found", { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  return new Response(renderCsv(preset, data.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${preset.filename(data.org.name, today)}"`,
    },
  });
}
