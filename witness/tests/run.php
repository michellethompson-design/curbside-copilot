#!/usr/bin/env php
<?php

/**
 * Witness test suite — plain PHP, no framework:  php witness/tests/run.php
 * Covers the P0 guarantees: allowlist redaction, tenant hashing, sampling,
 * fail-open, trace format, and the diff script.
 */

require __DIR__ . '/../src/Witness.php';

$failures = 0;

function check(bool $cond, string $name): void
{
    global $failures;
    if ($cond) {
        echo "  ok: $name\n";
    } else {
        $failures++;
        echo "  FAIL: $name\n";
    }
}

// --- redaction ---------------------------------------------------------------
echo "redaction\n";
Witness::configure(['salt' => 'test-salt']);

$out = Witness::redact(
    ['plan' => 'premium', 'email' => 'a@b.com', 'user_id' => 42, 'note' => 'free text'],
    ['plan' => 'keep', 'user_id' => 'hash']
);
check($out['plan'] === 'premium', 'keep passes value through');
check(!array_key_exists('email', $out) && !array_key_exists('note', $out), 'unlisted fields dropped');
check(isset($out['user_id']) && $out['user_id'] !== '42' && strlen($out['user_id']) === 16, 'hash replaces value with 16-char digest');
check(($out['_dropped'] ?? 0) === 2, 'dropped count recorded');

$h1 = Witness::hashValue('tenant-1');
$h2 = Witness::hashValue('tenant-1');
$h3 = Witness::hashValue('tenant-2');
check($h1 === $h2 && $h1 !== $h3, 'hashing is stable per value, distinct across values');
Witness::configure(['salt' => 'other-salt']);
check(Witness::hashValue('tenant-1') !== $h1, 'hash depends on salt');

$nested = Witness::redact(
    ['line_items' => [['type' => 'ticket', 'amount' => 10, 'sku' => 'secret']], 'total' => 10],
    ['line_items' => ['*' => ['type' => 'keep', 'amount' => 'keep']], 'total' => 'keep']
);
check($nested['line_items'][0] === ['type' => 'ticket', 'amount' => 10, '_dropped' => 1], 'nested list allowlist applies per item');

$structKeep = Witness::redact(['blob' => ['a' => 1]], ['blob' => 'keep']);
check(!array_key_exists('blob', $structKeep), "'keep' on a structure without nested allowlist drops it");

// --- observe / sampling / fail-open -----------------------------------------
echo "observe\n";
$boundaries = [
    'b.on' => ['sample_rate' => 1.0, 'inputs' => ['x' => 'keep'], 'outputs' => ['y' => 'keep']],
    'b.off' => ['sample_rate' => 0.0, 'inputs' => ['x' => 'keep'], 'outputs' => []],
];
Witness::configure(['salt' => 's', 'boundaries' => $boundaries]);
Witness::drainBuffer();

Witness::observe('b.on', ['x' => 1, 'secret' => 'no'], ['y' => 2], ['tenant_id' => 't1']);
$lines = Witness::drainBuffer();
check(count($lines) === 1, 'observe buffers one trace');
$trace = json_decode($lines[0], true);
check($trace['boundary'] === 'b.on' && $trace['v'] === 1, 'trace carries boundary + schema version');
check(isset($trace['ts']) && isset($trace['tenant']) && strlen($trace['tenant']) === 16, 'trace carries timestamp + tenant hash');
check(($trace['inputs']['x'] ?? null) === 1 && !isset($trace['inputs']['secret']), 'observe applies redaction');
check(strpos($lines[0], 't1') === false, 'raw tenant id never persisted');

Witness::observe('b.off', ['x' => 1], []);
check(Witness::drainBuffer() === [], 'sample_rate 0 records nothing');

Witness::observe('b.unknown', ['x' => 1], ['y' => 2]);
check(Witness::drainBuffer() === [], 'unknown boundary records nothing');

$captured = null;
Witness::configure([
    'salt' => 's',
    'boundaries' => $boundaries,
    'sink' => function () { throw new RuntimeException('sink down'); },
    'on_error' => function ($e) use (&$captured) { $captured = $e; },
]);
Witness::observe('b.on', ['x' => 1], ['y' => 2]);
try {
    Witness::flush();
    check(true, 'flush with broken sink does not throw (fail-open)');
} catch (Throwable $e) {
    check(false, 'flush with broken sink does not throw (fail-open)');
}
check($captured instanceof RuntimeException, 'error callback invoked on sink failure');

Witness::configure(['salt' => 's', 'boundaries' => $boundaries, 'enabled' => false]);
Witness::observe('b.on', ['x' => 1], ['y' => 2]);
check(Witness::drainBuffer() === [], 'kill switch disables tracing');

// --- file sink + purge -------------------------------------------------------
echo "file sink\n";
$tmp = sys_get_temp_dir() . '/witness-test-' . getmypid();
@mkdir($tmp, 0777, true);
Witness::configure(['salt' => 's', 'trace_dir' => $tmp, 'boundaries' => $boundaries]);
Witness::observe('b.on', ['x' => 7], ['y' => 8]);
Witness::flush();
$files = glob("$tmp/witness-*.jsonl");
check(count($files) === 1, 'flush writes date-partitioned JSONL file');
check($files && substr_count(file_get_contents($files[0]), "\n") === 1, 'one line per trace');

$oldFile = "$tmp/witness-20200101.jsonl";
file_put_contents($oldFile, "{}\n");
exec(sprintf('php %s --dir=%s --days=90 2>/dev/null', escapeshellarg(__DIR__ . '/../bin/purge-traces.php'), escapeshellarg($tmp)));
check(!file_exists($oldFile), 'purge deletes files past retention');
check(file_exists($files[0]), 'purge keeps files inside retention');

// --- diff script -------------------------------------------------------------
echo "diff\n";
$oldMd = "$tmp/old.md";
$newMd = "$tmp/new.md";
file_put_contents($oldMd, "## Always true\n- Total equals base minus discount (held in 100/100)\n- Currency is always USD\n");
file_put_contents($newMd, "## Always true\n- **Total equals base minus discount** (held in 240/240)\n");

exec(sprintf('php %s %s %s 2>/dev/null', escapeshellarg(__DIR__ . '/../bin/diff-invariants.php'), escapeshellarg($oldMd), escapeshellarg($newMd)), $diffOut, $diffCode);
$diffText = implode("\n", $diffOut);
check($diffCode === 1, 'diff exits 1 when a rule vanished');
check(str_contains($diffText, 'VANISHED') && str_contains($diffText, 'currency is always usd'), 'vanished rule reported');
check(!str_contains($diffText, 'total equals'), 'reworded evidence counts do not register as changes');

exec(sprintf('php %s %s %s 2>/dev/null', escapeshellarg(__DIR__ . '/../bin/diff-invariants.php'), escapeshellarg($oldMd), escapeshellarg($oldMd)), $sameOut, $sameCode);
check($sameCode === 0, 'diff exits 0 on identical docs');

// --- miner dry-run over synthetic traces -------------------------------------
echo "miner (dry-run)\n";
$sampleDir = "$tmp/sample";
exec(sprintf('php %s %s 2>&1', escapeshellarg(__DIR__ . '/../examples/generate-sample-traces.php'), escapeshellarg($sampleDir)), $genOut, $genCode);
check($genCode === 0, 'sample generator runs');
exec(sprintf(
    'php %s --boundary=registration.pricing --traces=%s --dry-run 2>&1',
    escapeshellarg(__DIR__ . '/../bin/mine.php'),
    escapeshellarg("$sampleDir/witness-*.jsonl")
), $mineOut, $mineCode);
$mineText = implode("\n", $mineOut);
check($mineCode === 0, 'miner dry-run runs without API key');
check(str_contains($mineText, 'field_stats') && str_contains($mineText, '"boundary":"registration.pricing"'), 'prompt contains stats and traces');
check(!str_contains($mineText, 'example.com'), 'redacted fields never reach the prompt');

// cleanup
foreach (array_merge(glob("$tmp/witness-*.jsonl") ?: [], glob("$sampleDir/witness-*.jsonl") ?: [], [$oldMd, $newMd]) as $f) {
    @unlink($f);
}
@rmdir($sampleDir);
@rmdir($tmp);

echo $failures === 0 ? "\nall tests passed\n" : "\n$failures test(s) FAILED\n";
exit($failures === 0 ? 0 : 1);
