#!/usr/bin/env php
<?php

/**
 * Generate synthetic registration.pricing traces so the miner can be exercised
 * end-to-end without production data:
 *
 *   php witness/examples/generate-sample-traces.php var/witness-sample
 *   php witness/bin/mine.php --boundary=registration.pricing \
 *       --traces='var/witness-sample/witness-*.jsonl' --dry-run
 *
 * The data embeds one deliberate edge-case rule of the kind Witness exists to
 * surface: member pricing normally requires plan != 'free', EXCEPT one
 * university tenant on a grandfathered 'legacy-edu' plan that still gets the
 * discount. A correct mining run reports that under "~99% with exceptions".
 */

require __DIR__ . '/../src/Witness.php';

$outDir = $argv[1] ?? 'var/witness-sample';

Witness::configure([
    'salt' => 'sample-salt-not-for-production',
    'trace_dir' => $outDir,
    'boundaries' => (require __DIR__ . '/../config/boundaries.php'),
]);

mt_srand(42); // reproducible sample

$planPrices = ['free' => 25.00, 'standard' => 25.00, 'premium' => 25.00];
$legacyTenant = 'org-univ-legacy-17';

for ($i = 0; $i < 800; $i++) {
    $isLegacy = mt_rand(1, 60) === 1;
    $tenant = $isLegacy ? $legacyTenant : 'org-' . mt_rand(1, 40);
    $plan = $isLegacy ? 'legacy-edu' : array_rand($planPrices);
    $orgType = $isLegacy ? 'university' : (mt_rand(0, 1) ? 'k12' : 'association');
    $ticketType = mt_rand(0, 3) ? 'member' : 'general';
    $qty = mt_rand(1, 4);

    $base = 25.00 * $qty;
    // The rule: member tickets get 20% off on paid plans — and, the exception,
    // on the one grandfathered legacy-edu tenant.
    $discountEligible = $ticketType === 'member' && ($plan !== 'free' || $isLegacy);
    $discount = $discountEligible ? round($base * 0.20, 2) : 0.00;

    Witness::observe('registration.pricing', [
        'event_id' => 'evt-' . mt_rand(1, 120),
        'attendee_id' => 'att-' . $i,
        'org_type' => $orgType,
        'plan' => $plan,
        'ticket_type' => $ticketType,
        'quantity' => $qty,
        'promo_code_applied' => false,
        'currency' => 'USD',
        'registration_date' => gmdate('Y-m-d'),
        'email' => "user$i@example.com",   // must be dropped by redaction
    ], [
        'base_price' => $base,
        'discount' => $discount,
        'total' => $base - $discount,
        'currency' => 'USD',
        'error_code' => null,
    ], ['tenant_id' => $tenant]);
}

Witness::flush();
echo "wrote synthetic traces to $outDir\n";
