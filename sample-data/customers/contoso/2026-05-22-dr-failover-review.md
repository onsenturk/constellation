# Contoso Ltd — DR Failover Review

| Field | Value |
|---|---|
| Date | 2026-05-22 |
| Specialist | Alex Rivera |
| Customer contact | Priya Nair |
| Environment | SQL Server + Oracle on Azure VMs, vaulted immutable backup, WE→NE |
| Status | Reviewed |

## Summary

Regulatory DR review for Contoso's banking workloads. Backups land in the **vaulted immutable
tier** for compliance. We assessed whether cross-region failover meets the DR SLA.

## Findings

- Cross-region restore is supported from the vaulted tier (the in-region snapshot tier is not
  valid for cross-region DR).
- Failover RTO is dominated by **restore hydration time**, which has not been measured against
  the documented DR SLA.
- The **immutable lock period** is set for regulatory retention but has not been reconciled with
  the operational backup retention policy.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Measure cross-region restore hydration time and compare it to the DR SLA. | Alex Rivera | High |
| R2 | **Validate the immutable lock period against the retention policy** to avoid locked backups outliving their retention window. | Priya Nair | Medium |
| R3 | Document service-online vs. full-performance RTO for the failover runbook. | Alex Rivera | Medium |

## Risk

If hydration time is not validated, the regulated DR SLA may be missed during an actual failover.
