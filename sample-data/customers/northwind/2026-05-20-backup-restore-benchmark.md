# Northwind Traders — Backup & Restore Benchmark

| Field | Value |
|---|---|
| Date | 2026-05-20 |
| Specialist | Alex Rivera |
| Customer contact | Sam Okoye |
| Environment | Oracle 19c on Azure VMs, Premium SSD v2, West Europe |
| Status | Reviewed with customer |

## Summary

We benchmarked Azure Backup restore of the core logistics database from the **vaulted immutable
tier**. The restore *job* completes quickly, but the disk is only fully performant after
**background hydration**, which currently overshoots the agreed recovery-time objective (RTO).

## Findings

- The restore job provisions the disk in roughly 90 seconds, independent of data size.
- Real data copy happens as background hydration; full-performance restore of the ~4 TB volume
  takes about 4.3 hours.
- The restored disk is **attachable and readable before hydration finishes** — reads are served
  on demand from the vault.
- The **immutable lock period** on the backup container is set longer than the agreed backup
  retention policy, which complicates lifecycle cleanup.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | **Adopt attach-before-hydration as a standard DR runbook step** — attach the restored disk at 0% hydration and bring the service up while hydration completes underneath. | Alex Rivera | High |
| R2 | **Validate the immutable lock period against the retention policy** so locked backups do not outlive their retention window. | Sam Okoye | Medium |
| R3 | Set two distinct RTO expectations: service-online vs. return-to-full-performance. | Alex Rivera | High |

## Risk

Restore-to-full-performance currently exceeds the logistics database RTO during peak season.
Attach-before-hydration (R1) brings the service online in minutes rather than hours.
