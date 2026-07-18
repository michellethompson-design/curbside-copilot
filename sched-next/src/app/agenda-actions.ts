"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/demo-user";

export async function toggleAgenda(sessionId: string) {
  const user = await currentUser();
  if (!user) return;
  const existing = await db.agendaItem.findUnique({
    where: { personId_sessionId: { personId: user.id, sessionId } },
  });
  if (existing) {
    await db.agendaItem.delete({ where: { id: existing.id } });
  } else {
    await db.agendaItem.create({ data: { personId: user.id, sessionId } });
  }
  revalidatePath("/me");
  revalidatePath(`/sessions/${sessionId}`);
}
