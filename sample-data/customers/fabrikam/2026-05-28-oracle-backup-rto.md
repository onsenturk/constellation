# Fabrikam Inc — Oracle Backup Restore RTO

| Field | Value |
|---|---|
| Date | 2026-05-28 |
| Specialist | Alex Rivera |
| Customer contact | Lars Berg |
| Environment | Oracle 19c ERP on Azure VMs, Premium SSD v2, vaulted backup |
| Status | Reviewed with customer |

## Summary

Fabrikam's Oracle ERP database must recover within a 2-hour RTO. We tested an Azure Backup
restore and found the **hydration phase** is the bottleneck, mirroring what we saw at other
backup engagements.

## Findings

- The restore job completes in about 90 seconds (provisioning only); data hydrates in the
  background afterward.
- Full-performance restore of the ERP volume takes well over 2 hours, breaching the RTO.
- The restored disk is readable while hydration is still in progress.
- The current restore runbook waits for 100% hydration before starting the database — this is
  the main source of the RTO breach.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | **Adopt attach-before-hydration as a standard DR runbook step** — start Oracle against the restored disk at 0% hydration and let the copy finish underneath. | Alex Rivera | High |
| R2 | Pre-warm the most latency-sensitive tablespaces after attach to smooth first-touch reads. | Lars Berg | Medium |

## Risk

Without attach-before-hydration (R1), the ERP recovery cannot meet the agreed 2-hour RTO.
