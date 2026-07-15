"use client";

import { useState, useTransition } from "react";
import { toggleAgenda } from "@/app/agenda-actions";

export function AgendaButton({ sessionId, initial }: { sessionId: string; initial: boolean }) {
  const [inAgenda, setInAgenda] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      aria-pressed={inAgenda}
      onClick={() =>
        startTransition(async () => {
          setInAgenda(!inAgenda);
          await toggleAgenda(sessionId);
        })
      }
    >
      {inAgenda ? "✓ On my agenda — remove" : "+ Add to my agenda"}
    </button>
  );
}
