# Contoso Ltd — VM Rightsizing & Cost

| Field | Value |
|---|---|
| Date | 2026-06-05 |
| Specialist | Alex Rivera |
| Customer contact | Priya Nair |
| Environment | SQL Server + Oracle on Azure VMs, West Europe |
| Status | Reviewed |

## Summary

Cost-optimization review of Contoso's production VM estate. Several VMs are sized well above
their measured utilization, and reservations are not yet applied to the steady-state fleet.

## Findings

- 18 production VMs run below 25% average CPU over 30 days — candidates for rightsizing.
- No reserved instances or savings plans on a fleet that is clearly steady-state.
- Premium SSD v2 disks are over-provisioned on IOPS beyond the free baseline.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Rightsize the 18 under-utilized VMs one tier down and re-measure. | Alex Rivera | High |
| R2 | Apply 1-year reservations / savings plans to the steady-state fleet. | Priya Nair | High |
| R3 | Tune Premium SSD v2 IOPS to actual need; drop over-provisioned throughput. | Alex Rivera | Medium |

## Related

Same cost-optimization theme as the [Tailwind AKS cost review](../tailwind/2026-06-08-aks-cost-review.md).
