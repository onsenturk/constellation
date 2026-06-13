# Tailwind Traders — Engagement (fictional)

E-commerce. Database modernization (Oracle → PostgreSQL) and an AKS cost-control track.

| Date | Artifact | Topic |
|---|---|---|
| 2026-06-01 | [PostgreSQL migration assessment](2026-06-01-postgres-migration-assessment.md) | Oracle → PostgreSQL |
| 2026-06-08 | [AKS cost review](2026-06-08-aks-cost-review.md) | Cost optimization, AKS |

## Stack

- Oracle Database 19c (source) → Azure Database for PostgreSQL Flexible Server (target)
- Storefront on Azure Kubernetes Service (AKS)
- West Europe

## Open themes

- PL/SQL packages need conversion; a few use Oracle-specific features.
- AKS node pools are over-provisioned; pods lack right-sized requests/limits.
