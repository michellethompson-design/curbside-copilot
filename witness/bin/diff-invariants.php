#!/usr/bin/env php
<?php

/**
 * Compare two invariant docs for the same boundary; flag appeared/vanished
 * rules. A vanished "always true" rule is a behavior-change alarm.
 *
 * Usage:
 *   php witness/bin/diff-invariants.php docs/invariants/last-week.md docs/invariants/this-week.md
 *
 * Exit code 0 = no rule changes, 1 = rules appeared or vanished (alarm),
 * 2 = usage error. The same comparison later diffs legacy invariants against
 * NestJS shadow-mode invariants at migration time — build once, verify forever.
 */

if ($argc !== 3) {
    fwrite(STDERR, "usage: diff-invariants.php <old.md> <new.md>\n");
    exit(2);
}

[$_, $oldPath, $newPath] = $argv;
$old = extractRules($oldPath);
$new = extractRules($newPath);

$changed = false;
foreach (['Always true', 'True ~99% of the time — with exceptions'] as $section) {
    $vanished = array_diff($old[$section] ?? [], $new[$section] ?? []);
    $appeared = array_diff($new[$section] ?? [], $old[$section] ?? []);
    if ($vanished === [] && $appeared === []) {
        continue;
    }
    $changed = true;
    echo "## $section\n";
    foreach ($vanished as $rule) {
        echo "  VANISHED: $rule\n";
    }
    foreach ($appeared as $rule) {
        echo "  APPEARED: $rule\n";
    }
}

if (!$changed) {
    echo "no invariant changes\n";
    exit(0);
}
exit(1);

/**
 * Pull top-level bullet lines out of each "## Section", normalized so
 * cosmetic rewording (whitespace, trailing punctuation, evidence counts)
 * doesn't register as a rule change.
 *
 * @return array<string, string[]> section title => normalized rules
 */
function extractRules(string $path): array
{
    $text = @file_get_contents($path);
    if ($text === false) {
        fwrite(STDERR, "cannot read $path\n");
        exit(2);
    }
    $rules = [];
    $section = null;
    foreach (preg_split('/\R/', $text) as $line) {
        if (preg_match('/^##\s+(.+?)\s*$/', $line, $m)) {
            $section = $m[1];
            continue;
        }
        if ($section !== null && preg_match('/^[-*]\s+(.+)$/', $line, $m)) {
            $rule = $m[1];
            $rule = preg_replace('/\*\*/', '', $rule);              // bold markers
            $rule = preg_replace('/\s*\(held in [^)]*\)/i', '', $rule); // evidence counts
            $rule = preg_replace('/\s*\d[\d,]*\/\d[\d,]*\s*/', ' ', $rule); // n/m tallies
            $rule = strtolower(trim(preg_replace('/\s+/', ' ', $rule), " .;"));
            if ($rule !== '') {
                $rules[$section][] = $rule;
            }
        }
    }
    return $rules;
}
