<?php

/**
 * Witness — production trace capture for the Sched rebuild.
 *
 * One class, no dependencies. Drop into the legacy codebase and call:
 *
 *     Witness::observe('checkout.pricing', $inputs, $outputs, ['tenant_id' => $orgId]);
 *
 * Design constraints (see PRD "Witness — Production Trace Mining"):
 *  - Redaction is built in, not bolted on: per-boundary allowlist. A field
 *    with no allowlist entry is NEVER persisted.
 *  - Fail-open: nothing thrown from observe() ever reaches the caller.
 *    If tracing breaks, the customer request proceeds untouched.
 *  - Off the hot path: traces buffer in memory and flush once on shutdown.
 *  - Sampling is config, not code.
 */
final class Witness
{
    public const SCHEMA_VERSION = 1;

    /** @var array<string, array{sample_rate?: float, inputs?: array, outputs?: array}> */
    private static array $boundaries = [];

    private static ?string $salt = null;

    private static ?string $traceDir = null;

    /** @var callable|null custom sink: fn(array $jsonLines): void — replaces the file sink */
    private static $sink = null;

    /** @var callable|null fn(\Throwable $e): void — observability for tracing failures */
    private static $onError = null;

    /** @var string[] pending JSON lines */
    private static array $buffer = [];

    private static bool $shutdownRegistered = false;

    private static bool $enabled = true;

    /**
     * Call once at bootstrap.
     *
     * $config keys:
     *   'salt'       string   required — HMAC salt for tenant hashing. Keep out of
     *                         source control (env var); rotating it breaks cross-week
     *                         tenant joins, so treat it like a credential.
     *   'trace_dir'  string   directory for JSONL trace files (date-partitioned:
     *                         witness-YYYYMMDD.jsonl). Ignored if 'sink' is set.
     *   'sink'       callable optional — fn(array $jsonLines): void, e.g. a DB insert.
     *   'on_error'   callable optional — fn(\Throwable): void, e.g. Sentry capture.
     *                         Errors thrown from this callback are swallowed too.
     *   'enabled'    bool     optional kill switch, default true.
     *   'boundaries' array    per-boundary config, see config/boundaries.php.
     */
    public static function configure(array $config): void
    {
        self::$salt = $config['salt'] ?? null;
        self::$traceDir = $config['trace_dir'] ?? null;
        self::$sink = $config['sink'] ?? null;
        self::$onError = $config['on_error'] ?? null;
        self::$enabled = $config['enabled'] ?? true;
        self::$boundaries = $config['boundaries'] ?? [];
    }

    /**
     * Record one observation at a boundary. Never throws.
     *
     * $context supports:
     *   'tenant_id' string|int — hashed (never stored raw) so traces can be grouped
     *                            per tenant without identifying the tenant.
     */
    public static function observe(string $boundary, array $inputs, array $outputs, array $context = []): void
    {
        if (!self::$enabled) {
            return;
        }

        try {
            $cfg = self::$boundaries[$boundary] ?? null;
            if ($cfg === null) {
                // Unknown boundary => no allowlist => nothing may persist.
                return;
            }

            $rate = (float) ($cfg['sample_rate'] ?? 1.0);
            if ($rate < 1.0 && (mt_rand() / mt_getrandmax()) >= $rate) {
                return;
            }

            $trace = [
                'v' => self::SCHEMA_VERSION,
                'boundary' => $boundary,
                'ts' => gmdate('Y-m-d\TH:i:s\Z'),
                'tenant' => isset($context['tenant_id']) ? self::hashValue((string) $context['tenant_id']) : null,
                'sample_rate' => $rate,
                'inputs' => self::redact($inputs, $cfg['inputs'] ?? []),
                'outputs' => self::redact($outputs, $cfg['outputs'] ?? []),
            ];

            $line = json_encode($trace, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
            if ($line === false) {
                return;
            }

            self::$buffer[] = $line;

            if (!self::$shutdownRegistered) {
                self::$shutdownRegistered = true;
                register_shutdown_function([self::class, 'flush']);
            }
        } catch (\Throwable $e) {
            self::reportError($e);
        }
    }

    /**
     * Write buffered traces. Registered as a shutdown function so the write
     * happens after the response is sent; safe to call manually (e.g. in
     * long-running workers). Never throws.
     */
    public static function flush(): void
    {
        if (self::$buffer === []) {
            return;
        }
        $lines = self::$buffer;
        self::$buffer = [];

        try {
            if (self::$sink !== null) {
                (self::$sink)($lines);
                return;
            }
            if (self::$traceDir === null) {
                return;
            }
            if (!is_dir(self::$traceDir)) {
                @mkdir(self::$traceDir, 0770, true);
            }
            $path = rtrim(self::$traceDir, '/') . '/witness-' . gmdate('Ymd') . '.jsonl';
            @file_put_contents($path, implode("\n", $lines) . "\n", FILE_APPEND | LOCK_EX);
        } catch (\Throwable $e) {
            self::reportError($e);
        }
    }

    /**
     * Allowlist-based redaction. The allowlist maps field name to one of:
     *   'keep'  — value passes through (scalars and lists of scalars only)
     *   'hash'  — value replaced by a salted HMAC prefix (joinable, not reversible)
     *   array   — recurse into a nested array with a nested allowlist
     *
     * Anything else — including fields absent from the allowlist — is dropped.
     * A '_dropped' count records how many fields were withheld, so the miner
     * can flag boundaries whose allowlist is starving it, without leaking names.
     */
    public static function redact(array $data, array $allowlist): array
    {
        $out = [];
        $dropped = 0;

        // Numeric lists: apply the item rule under '*' to each element.
        if (array_is_list($data) && isset($allowlist['*'])) {
            $rule = $allowlist['*'];
            foreach ($data as $item) {
                if (is_array($rule) && is_array($item)) {
                    $out[] = self::redact($item, $rule);
                } elseif ($rule === 'keep' && is_scalar($item)) {
                    $out[] = $item;
                } elseif ($rule === 'hash' && is_scalar($item)) {
                    $out[] = self::hashValue((string) $item);
                } else {
                    $dropped++;
                }
            }
            if ($dropped > 0) {
                $out['_dropped'] = $dropped;
            }
            return $out;
        }

        foreach ($data as $key => $value) {
            $rule = $allowlist[$key] ?? null;
            if ($rule === null) {
                $dropped++;
                continue;
            }
            if (is_array($rule)) {
                $out[$key] = is_array($value) ? self::redact($value, $rule) : null;
            } elseif ($rule === 'keep') {
                if (is_scalar($value) || $value === null) {
                    $out[$key] = $value;
                } elseif (is_array($value) && array_is_list($value) && self::isScalarList($value)) {
                    $out[$key] = $value;
                } else {
                    $dropped++; // 'keep' on a structure needs an explicit nested allowlist
                }
            } elseif ($rule === 'hash') {
                $out[$key] = is_scalar($value) ? self::hashValue((string) $value) : null;
            } else {
                $dropped++;
            }
        }

        if ($dropped > 0) {
            $out['_dropped'] = $dropped;
        }
        return $out;
    }

    public static function hashValue(string $value): string
    {
        // 16 hex chars: enough to join within our dataset, useless to reverse.
        return substr(hash_hmac('sha256', $value, self::$salt ?? ''), 0, 16);
    }

    private static function isScalarList(array $list): bool
    {
        foreach ($list as $v) {
            if (!is_scalar($v) && $v !== null) {
                return false;
            }
        }
        return true;
    }

    private static function reportError(\Throwable $e): void
    {
        if (self::$onError !== null) {
            try {
                (self::$onError)($e);
            } catch (\Throwable $ignored) {
                // fail-open all the way down
            }
        }
    }

    /** Test helper: drop unflushed traces and return them. */
    public static function drainBuffer(): array
    {
        $b = self::$buffer;
        self::$buffer = [];
        return $b;
    }
}
