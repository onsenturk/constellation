# Constellation — Synthetic Sample Data

> **100% fictional.** Every company, person, and engagement below is invented for the
> Agents League Hackathon demo. No real customer data appears here. Copy this folder into the
> new public `constellation` repo as its `data/` directory.

This set mirrors the *shape* of a real multi-customer specialist workspace — dated technical
reports under `customers/<slug>/`, a shared `tasks/open.md`, a meeting transcript, and a daily
prep note — so Constellation can ingest it and reveal cross-customer patterns.

## Fictional companies

| Company | Industry | Primary themes |
|---|---|---|
| Northwind Traders | Logistics / retail | Backup & DR, immutable storage |
| Contoso Ltd | Banking | DR failover, cost optimization |
| Fabrikam Inc | Manufacturing | Oracle backup, restore RTO |
| Tailwind Traders | E-commerce | Oracle → PostgreSQL migration, AKS cost |
| Proseware Inc | Software / media | Oracle → PostgreSQL migration |

## Planted cross-customer patterns (what the demo should surface)

The data is deliberately seeded so the three demo prompts return real hits.

### Pattern A — Backup / DR restore risk (immutable storage + slow restore RTO)

Shared by **Northwind, Contoso, Fabrikam**. All three run database backups to immutable
vaulted storage and hit slow restore hydration that threatens RTO.

- [customers/northwind/2026-05-20-backup-restore-benchmark.md](customers/northwind/2026-05-20-backup-restore-benchmark.md)
- [customers/contoso/2026-05-22-dr-failover-review.md](customers/contoso/2026-05-22-dr-failover-review.md)
- [customers/fabrikam/2026-05-28-oracle-backup-rto.md](customers/fabrikam/2026-05-28-oracle-backup-rto.md)

### Pattern B — Oracle → PostgreSQL migration

Shared by **Tailwind, Proseware**.

- [customers/tailwind/2026-06-01-postgres-migration-assessment.md](customers/tailwind/2026-06-01-postgres-migration-assessment.md)
- [customers/proseware/2026-06-03-oracle-to-postgres-plan.md](customers/proseware/2026-06-03-oracle-to-postgres-plan.md)

### Pattern C — Cost rightsizing

Shared by **Contoso, Tailwind**.

- [customers/contoso/2026-06-05-vm-rightsizing-cost.md](customers/contoso/2026-06-05-vm-rightsizing-cost.md)
- [customers/tailwind/2026-06-08-aks-cost-review.md](customers/tailwind/2026-06-08-aks-cost-review.md)

### Planted "repeated recommendation, not yet a tracked action" (demo prompt 3)

Two recommendations recur across reports but are **deliberately absent** from
[tasks/open.md](tasks/open.md), so Constellation can flag them as un-actioned:

1. **"Adopt attach-before-hydration as a standard DR runbook step"** — appears in the Northwind
   and Fabrikam reports.
2. **"Validate the immutable lock period against the retention policy"** — appears in the
   Northwind and Contoso reports.

## Folder layout

```text
sample-data/
├─ customers/
│  ├─ northwind/   (README + 2 reports)
│  ├─ contoso/     (README + 2 reports)
│  ├─ fabrikam/    (README + 1 report)
│  ├─ tailwind/    (README + 2 reports)
│  └─ proseware/   (README + 1 report)
├─ tasks/open.md
├─ meetings/2026-06-10-northwind-dr-sync.md
└─ prep/2026-06-12-prep.md
```
