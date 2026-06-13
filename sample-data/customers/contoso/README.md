# Contoso Ltd — Engagement (fictional)

Banking. Regulated DR program plus an Azure cost-optimization track.

| Date | Artifact | Topic |
|---|---|---|
| 2026-05-22 | [DR failover review](2026-05-22-dr-failover-review.md) | DR failover, immutable backup |
| 2026-06-05 | [VM rightsizing & cost](2026-06-05-vm-rightsizing-cost.md) | Cost optimization |

## Stack

- SQL Server and Oracle workloads on Azure VMs
- Azure Backup vaulted tier with immutable policy (regulatory retention)
- Cross-region DR (West Europe → North Europe)

## Open themes

- Failover RTO depends on restore hydration time; needs validation against the DR SLA.
- Several production VMs are over-provisioned versus measured utilization.
