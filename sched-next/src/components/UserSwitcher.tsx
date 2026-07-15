"use client";

import { useTransition } from "react";
import { switchDemoUser } from "@/app/actions";

export function UserSwitcher({
  options,
  currentId,
}: {
  options: { id: string; label: string }[];
  currentId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="switcher">
      <label htmlFor="demo-user">Viewing as</label>
      <select
        id="demo-user"
        value={currentId}
        disabled={pending}
        onChange={(e) => startTransition(() => switchDemoUser(e.target.value))}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
