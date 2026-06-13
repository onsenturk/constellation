# Proseware Inc — Engagement (fictional)

Software / media. Migrating a reporting database from Oracle to PostgreSQL.

| Date | Artifact | Topic |
|---|---|---|
| 2026-06-03 | [Oracle to PostgreSQL plan](2026-06-03-oracle-to-postgres-plan.md) | Oracle → PostgreSQL |

## Stack

- Oracle Database 19c (source) → Azure Database for PostgreSQL Flexible Server (target)
- Reporting / analytics workload
- North Europe

## Open themes

- Heavy use of materialized views and Oracle analytic functions.
- Cutover window is tight; needs a phased migration with validation.
