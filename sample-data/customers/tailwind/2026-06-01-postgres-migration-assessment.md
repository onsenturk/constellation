# Tailwind Traders — PostgreSQL Migration Assessment

| Field | Value |
|---|---|
| Date | 2026-06-01 |
| Specialist | Alex Rivera |
| Customer contact | Mei Tan |
| Environment | Oracle 19c → Azure Database for PostgreSQL Flexible Server, West Europe |
| Status | Assessment |

## Summary

Assessment for migrating Tailwind's storefront database from Oracle to **Azure Database for
PostgreSQL Flexible Server**. Schema is moderate; the main effort is PL/SQL conversion.

## Findings

- ~120 PL/SQL packages; about 15% use Oracle-specific features (sequences-in-DEFAULT,
  `CONNECT BY`, packaged globals).
- Application uses a handful of Oracle-only SQL functions that need PostgreSQL equivalents.
- Passwordless authentication with Microsoft Entra ID is a fit for the target.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Convert PL/SQL with an automated tool first, then hand-finish the ~15% Oracle-specific logic. | Alex Rivera | Medium |
| R2 | Adopt Entra ID (passwordless) authentication on the PostgreSQL target. | Mei Tan | High |
| R3 | Run a phased migration with a validation window before cutover. | Alex Rivera | High |

## Related

Same target platform as the [Proseware Oracle → PostgreSQL plan](../proseware/2026-06-03-oracle-to-postgres-plan.md).
