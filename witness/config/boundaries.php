<?php

/**
 * Per-boundary Witness config: sampling rate + redaction allowlist.
 *
 * THE ALLOWLIST IS THE PRIVACY BOUNDARY. A field not listed here is dropped
 * before anything is buffered or written. Rules:
 *   'keep' — business-relevant, non-identifying values (org_type, plan,
 *            amounts, dates, flags, enum-ish statuses)
 *   'hash' — identifiers we need for joining but must not store raw
 *            (user ids, emails used as keys, session ids)
 *   array  — nested allowlist for structured fields ('*' applies to list items)
 *
 * Never 'keep': email, names, addresses, phone numbers, free text, tokens.
 *
 * Field names below match the PRD's 8 boundaries and are a starting point —
 * the engineer instrumenting each call site trims/extends them to the actual
 * shapes at that boundary. Sampling: 100% on rare paths, ~5% on hot paths.
 */

return [

    // 1. CFP submission create/read + status transitions (first rebuild module;
    //    ENG-1483; the NJ Coalition denied-speakers-got-"confirmed" bug)
    'cfp.submission' => [
        'sample_rate' => 1.0,
        'inputs' => [
            'event_id' => 'hash',
            'speaker_id' => 'hash',
            'action' => 'keep',            // create | update | transition
            'from_status' => 'keep',
            'to_status' => 'keep',
            'submitted_at' => 'keep',
            'track' => 'keep',
            'session_format' => 'keep',
        ],
        'outputs' => [
            'status' => 'keep',
            'notification_sent' => 'keep',
            'notification_template' => 'keep', // the NJ Coalition bug lives here
            'success' => 'keep',
            'error_code' => 'keep',
        ],
    ],

    // 2. Registration/pricing calculation (Sched-side only; tax/invoicing are
    //    Chargebee→Anrok, out of scope)
    'registration.pricing' => [
        'sample_rate' => 1.0,
        'inputs' => [
            'event_id' => 'hash',
            'attendee_id' => 'hash',
            'org_type' => 'keep',
            'plan' => 'keep',
            'ticket_type' => 'keep',
            'quantity' => 'keep',
            'promo_code_applied' => 'keep', // boolean, not the code itself
            'currency' => 'keep',
            'registration_date' => 'keep',
        ],
        'outputs' => [
            'base_price' => 'keep',
            'discount' => 'keep',
            'total' => 'keep',
            'currency' => 'keep',
            'line_items' => ['*' => ['type' => 'keep', 'amount' => 'keep']],
            'error_code' => 'keep',
        ],
    ],

    // 3. Permissions/role checks (cross-cutting; IDOR history)
    'auth.permission_check' => [
        'sample_rate' => 0.05,
        'inputs' => [
            'actor_id' => 'hash',
            'actor_role' => 'keep',
            'resource_type' => 'keep',
            'resource_id' => 'hash',
            'action' => 'keep',
            'via' => 'keep',               // ui | api | schedmin
        ],
        'outputs' => [
            'allowed' => 'keep',
            'reason' => 'keep',            // enum-ish denial reason, not free text
        ],
    ],

    // 4. Org ↔ subscription ↔ event linking / plan entitlements
    //    (Harvard unauthorized-access bug; three known linking paths)
    'org.entitlement' => [
        'sample_rate' => 1.0,
        'inputs' => [
            'org_id' => 'hash',
            'subscription_id' => 'hash',
            'event_id' => 'hash',
            'linking_path' => 'keep',      // schedmin | org_dashboard | chargebee_checkout
            'plan' => 'keep',
            'action' => 'keep',
        ],
        'outputs' => [
            'entitled' => 'keep',
            'entitlement_source' => 'keep',
            'plan_resolved' => 'keep',
            'error_code' => 'keep',
        ],
    ],

    // 5. Check-in / attendance recording (session + event level + QR flows)
    'attendance.checkin' => [
        'sample_rate' => 0.05,
        'inputs' => [
            'event_id' => 'hash',
            'session_id' => 'hash',
            'attendee_id' => 'hash',
            'method' => 'keep',            // qr | camera | manual | kiosk
            'level' => 'keep',             // session | event
            'checked_in_at' => 'keep',
        ],
        'outputs' => [
            'recorded' => 'keep',
            'duplicate' => 'keep',
            'error_code' => 'keep',
        ],
    ],

    // 6. PD hours calculation (new SLC code — trace it from birth)
    'pd.hours' => [
        'sample_rate' => 1.0,
        'inputs' => [
            'attendee_id' => 'hash',
            'event_id' => 'hash',
            'sessions_attended' => 'keep',
            'checkin_method' => 'keep',
            'credit_type' => 'keep',
        ],
        'outputs' => [
            'hours_awarded' => 'keep',
            'sessions_counted' => 'keep',
            'sessions_excluded' => 'keep',
            'exclusion_reasons' => ['*' => 'keep'],
            'error_code' => 'keep',
        ],
    ],

    // 7. Automated email / notification triggers (ENG-873)
    'notification.trigger' => [
        'sample_rate' => 0.05,
        'inputs' => [
            'event_id' => 'hash',
            'recipient_id' => 'hash',
            'trigger' => 'keep',           // what fired: reminder | status_change | ...
            'template' => 'keep',
            'session_deleted' => 'keep',
            'scheduled_for' => 'keep',
        ],
        'outputs' => [
            'sent' => 'keep',
            'suppressed' => 'keep',
            'suppression_reason' => 'keep',
            'error_code' => 'keep',
        ],
    ],

    // 8. Ticketing API (beta) — mined invariants double as the missing docs
    'ticketing.api' => [
        'sample_rate' => 1.0,
        'inputs' => [
            'api_client_id' => 'hash',
            'endpoint' => 'keep',
            'method' => 'keep',
            'event_id' => 'hash',
            'ticket_type' => 'keep',
            'quantity' => 'keep',
        ],
        'outputs' => [
            'http_status' => 'keep',
            'error_code' => 'keep',
            'tickets_issued' => 'keep',
        ],
    ],
];
