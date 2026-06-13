# Meeting — Northwind DR Sync (fictional transcript)

| Field | Value |
|---|---|
| Date | 2026-06-10 |
| Attendees | Alex Rivera (specialist), Sam Okoye (Northwind) |
| Topic | Backup restore RTO and immutable storage follow-ups |

## Transcript (excerpt)

**Alex:** Thanks for the time. The headline from the benchmark is that the restore job is fast,
but full-performance hydration of the logistics database runs about four hours — that's over the
RTO.

**Sam:** That's the part leadership worries about. Peak season we can't be slow for hours.

**Alex:** Right. The lever is attach-before-hydration — we bring the database up against the
restored disk at zero percent and let the copy finish underneath. Service-online drops to
minutes. We saw the same pattern at another manufacturing engagement.

**Sam:** I like it. We haven't written that into our runbook yet, though.

**Alex:** Agreed, it isn't formalized anywhere. We should make it a standard runbook step, but
let's confirm owners before we commit a date.

**Sam:** And the immutability issue?

**Alex:** The lock period is longer than your retention policy, so expired backups can't be
cleaned up on time. We still need to reconcile those two — also not tracked yet.

**Sam:** Okay. Let's at least get the measurement work moving.

## Action items

- [ ] Sam to confirm the RMAN unique-handle change landed in the nightly job. (owner: Sam Okoye)
- [ ] Alex to publish the two RTO numbers (service-online vs. full-performance). (owner: Alex Rivera)

> Discussed but **not yet assigned**: formalizing attach-before-hydration as a runbook step, and
> reconciling the immutable lock period with the retention policy.
