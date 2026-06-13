# Northwind Traders — Engagement (fictional)

Logistics / retail. Azure migration of an on-prem Oracle estate; focus on backup and
disaster recovery.

| Date | Artifact | Topic |
|---|---|---|
| 2026-05-20 | [Backup & restore benchmark](2026-05-20-backup-restore-benchmark.md) | Backup / DR, immutable storage |
| 2026-06-02 | [RMAN to immutable blob](2026-06-02-immutable-storage-rman.md) | Oracle RMAN, immutability |

## Stack

- Oracle Database 19c on Azure VMs (Premium SSD v2 data disks)
- Azure Backup vaulted tier + immutable blob storage
- Primary region West Europe, paired DR in North Europe

## Open themes

- Restore hydration is slower than the agreed RTO for the core logistics database.
- Immutable lock period was set longer than the backup retention policy.
