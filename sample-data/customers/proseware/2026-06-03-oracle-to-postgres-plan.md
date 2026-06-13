# Proseware Inc — Oracle to PostgreSQL Migration Plan

| Field | Value |
|---|---|
| Date | 2026-06-03 |
| Specialist | Alex Rivera |
| Customer contact | Tomás Ruiz |
| Environment | Oracle 19c → Azure Database for PostgreSQL Flexible Server, North Europe |
| Status | Plan |

## Summary

Migration plan for Proseware's reporting database from Oracle to **Azure Database for PostgreSQL
Flexible Server**. The workload is analytics-heavy, so materialized views and analytic functions
drive the effort.

## Findings

- Extensive use of materialized views and Oracle analytic functions (`LISTAGG`, window
  functions with Oracle-specific syntax).
- Nightly batch refresh must keep running during the migration.
- Tight cutover window aligned to a monthly reporting cycle.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Rebuild materialized views natively in PostgreSQL; validate refresh timings against the batch window. | Alex Rivera | Medium |
| R2 | Map Oracle analytic functions to PostgreSQL equivalents and unit-test report outputs. | Tomás Ruiz | Medium |
| R3 | Phase the cutover around the monthly reporting cycle with a rollback path. | Alex Rivera | High |

## Related

Same target platform as the [Tailwind PostgreSQL migration assessment](../tailwind/2026-06-01-postgres-migration-assessment.md).
