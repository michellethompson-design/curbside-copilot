// Query-param date parsing: a malformed date is undefined, never an Invalid
// Date that detonates inside Prisma as a bare 500.
export function parseDateParam(v: string | null | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function invalidDateParam(v: string | null | undefined): boolean {
  return !!v && Number.isNaN(new Date(v).getTime());
}
