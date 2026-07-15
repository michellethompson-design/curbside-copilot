import { PrismaClient } from "@prisma/client";

// The ledger guard. CreditRecord is append-only — an accounting ledger, not a
// table of mutable rows. Every code path that touches the database goes
// through this client, so update/delete on the ledger fails loudly no matter
// who writes the calling code. Corrections go through appendCorrection() in
// src/lib/ledger.ts as offsetting entries with a reason.
const LEDGER_MUTATIONS = new Set([
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

function buildClient() {
  const base = new PrismaClient();
  return base.$extends({
    query: {
      creditRecord: {
        $allOperations({ operation, query, args }) {
          if (LEDGER_MUTATIONS.has(operation)) {
            throw new Error(
              `CreditRecord is an append-only ledger; "${operation}" is not permitted. ` +
                "Write an offsetting ADJUSTMENT entry with a reason instead.",
            );
          }
          return query(args);
        },
      },
    },
  });
}

type Db = ReturnType<typeof buildClient>;

// Reuse the client across Next.js hot reloads.
const globalForDb = globalThis as unknown as { db?: Db };

export const db: Db = globalForDb.db ?? buildClient();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
