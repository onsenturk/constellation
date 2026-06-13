# Fabrikam Inc — Engagement (fictional)

Manufacturing. Lift-and-shift of an Oracle ERP database to Azure with a strict recovery target.

| Date | Artifact | Topic |
|---|---|---|
| 2026-05-28 | [Oracle backup restore RTO](2026-05-28-oracle-backup-rto.md) | Oracle backup, restore RTO |

## Stack

- Oracle Database 19c on Azure VMs (Premium SSD v2)
- Azure Backup vaulted tier
- Single-region production (West Europe) with cross-region restore for DR

## Open themes

- Full restore of the ERP database exceeds the 2-hour RTO during hydration.
- Restore runbook does not yet exploit attach-before-hydration.
