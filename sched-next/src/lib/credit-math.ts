// Credit math. The one part of the prototype that earns automated tests
// (SPEC.md Stage 2): one wrong transcript number in a live demo is
// unrecoverable.

export type RoundingMode = "FLOOR" | "NEAREST" | "CEILING";

export interface RoundingPolicy {
  /** Minutes of instruction that equal 1.0 credit unit (60 for clock hours). */
  minutesPerUnit: number;
  /** Rounding granularity in minutes, e.g. 15 for quarter-hour. */
  incrementMinutes: number;
  mode: RoundingMode;
}

/**
 * Convert raw instructional minutes to credit units under a policy.
 *
 * Minutes are first rounded to the policy's increment (floor / nearest /
 * ceiling), then divided by minutesPerUnit. Example, quarter-hour increments
 * on clock hours: 50 minutes → floor 0.75, nearest 0.75, ceiling 1.0.
 */
export function minutesToUnits(minutes: number, policy: RoundingPolicy): number {
  if (minutes <= 0) return 0;
  const { incrementMinutes, minutesPerUnit, mode } = policy;
  const steps = minutes / incrementMinutes;
  let roundedSteps: number;
  switch (mode) {
    case "FLOOR":
      roundedSteps = Math.floor(steps + 1e-9);
      break;
    case "CEILING":
      roundedSteps = Math.ceil(steps - 1e-9);
      break;
    case "NEAREST":
      // Half-up: 7.5 min at quarter-hour rounds to 15, matching how PD
      // offices resolve ties in the educator's favor.
      roundedSteps = Math.floor(steps + 0.5);
      break;
  }
  const roundedMinutes = roundedSteps * incrementMinutes;
  // Round to 4 decimals to keep floats presentable (0.75, not 0.7500000001).
  return Math.round((roundedMinutes / minutesPerUnit) * 10000) / 10000;
}

export function sessionMinutes(startsAt: Date, endsAt: Date): number {
  return Math.max(0, (endsAt.getTime() - startsAt.getTime()) / 60000);
}

/** Plain-language description of a policy, shown in org settings. */
export function describePolicy(policy: RoundingPolicy, unit: string): string {
  const inc =
    policy.incrementMinutes === 15
      ? "quarter hour"
      : policy.incrementMinutes === 30
        ? "half hour"
        : policy.incrementMinutes === 60
          ? "full hour"
          : `${policy.incrementMinutes} minutes`;
  const mode =
    policy.mode === "FLOOR"
      ? "rounded down"
      : policy.mode === "CEILING"
        ? "rounded up"
        : "rounded to the nearest";
  const per =
    policy.minutesPerUnit === 60
      ? `Sixty minutes of instruction equal 1.0 ${unit.replace(/s$/, "")}.`
      : `${policy.minutesPerUnit} minutes of instruction equal 1.0 ${unit.replace(/s$/, "")}.`;
  return `Session time is ${mode} ${policy.mode === "NEAREST" ? inc : `to the ${inc}`}. ${per}`;
}
