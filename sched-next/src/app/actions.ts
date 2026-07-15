"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEMO_USER_COOKIE } from "@/lib/demo-user";

export async function switchDemoUser(personId: string) {
  const jar = await cookies();
  jar.set(DEMO_USER_COOKIE, personId, { path: "/" });
  revalidatePath("/", "layout");
}
