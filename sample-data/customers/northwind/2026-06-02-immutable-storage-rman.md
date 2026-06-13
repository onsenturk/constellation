# Northwind Traders — Oracle RMAN to Immutable Blob

| Field | Value |
|---|---|
| Date | 2026-06-02 |
| Specialist | Alex Rivera |
| Customer contact | Sam Okoye |
| Environment | Oracle 19c, RMAN, Azure Blob (immutable), West Europe |
| Status | In progress |

## Summary

Northwind writes Oracle RMAN backups to an immutable blob container for ransomware protection.
We reviewed the configuration after RMAN reported write failures against locked blobs.

## Findings

- RMAN incremental backups failed when a **time-based immutability policy** blocked overwrite of
  an existing backup piece with the same name.
- The container's immutable lock period (180 days) is longer than the RMAN retention window
  (35 days), so expired pieces cannot be deleted on schedule.
- Append-friendly naming (unique backup-piece handles per run) avoids the overwrite conflict.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Use unique RMAN backup-piece handles per run so immutability never blocks an overwrite. | Sam Okoye | High |
| R2 | **Validate the immutable lock period against the retention policy** and align the two before expanding immutability to other databases. | Alex Rivera | High |

## Related

Continues the immutable-storage thread from the
[2026-05-20 backup & restore benchmark](2026-05-20-backup-restore-benchmark.md).
