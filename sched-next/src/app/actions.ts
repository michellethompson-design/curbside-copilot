"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";
import { DEMO_USER_COOKIE } from "@/lib/demo-user";

export async function switchDemoUser(personId: string) {
  const jar = await cookies();
  // Switching demo identity ends any real signed-in session so the switcher
  // always wins visibly — no two-identity confusion mid-demo.
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  jar.set(DEMO_USER_COOKIE, personId, { path: "/" });
  revalidatePath("/", "layout");
}
