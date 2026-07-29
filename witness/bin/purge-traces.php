#!/usr/bin/env php
<?php

/**
 * Enforce trace retention (P0: traces are customer data, default 90 days).
 * Run daily from cron:
 *
 *   php witness/bin/purge-traces.php --dir=var/witness [--days=90] [--dry-run]
 *
 * Trace files are date-partitioned (witness-YYYYMMDD.jsonl), so retention is
 * a file delete — no row scans. Mined invariant docs contain no raw data and
 * persist indefinitely.
 */

$opts = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([^=]+)(?:=(.*))?$/', $arg, $m)) {
        $opts[$m[1]] = $m[2] ?? true;
    }
}

$dir = $opts['dir'] ?? null;
if ($dir === null || !is_dir($dir)) {
    fwrite(STDERR, "usage: purge-traces.php --dir=<trace dir> [--days=90] [--dry-run]\n");
    exit(2);
}
$days = (int) ($opts['days'] ?? 90);
$dryRun = isset($opts['dry-run']);
$cutoff = gmdate('Ymd', time() - $days * 86400);

$deleted = 0;
foreach (glob(rtrim($dir, '/') . '/witness-*.jsonl') ?: [] as $file) {
    if (!preg_match('/witness-(\d{8})\.jsonl$/', $file, $m) || $m[1] >= $cutoff) {
        continue;
    }
    if ($dryRun) {
        echo "would delete $file\n";
    } elseif (unlink($file)) {
        echo "deleted $file\n";
        $deleted++;
    } else {
        fwrite(STDERR, "failed to delete $file\n");
    }
}
fwrite(STDERR, $dryRun ? "dry run complete\n" : "$deleted file(s) deleted (retention {$days}d)\n");
