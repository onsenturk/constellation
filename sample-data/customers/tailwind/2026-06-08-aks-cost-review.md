# Tailwind Traders — AKS Cost Review

| Field | Value |
|---|---|
| Date | 2026-06-08 |
| Specialist | Alex Rivera |
| Customer contact | Mei Tan |
| Environment | Azure Kubernetes Service (AKS), West Europe |
| Status | Reviewed |

## Summary

Cost review of the Tailwind storefront on AKS. Node pools are over-provisioned and most pods run
without right-sized resource requests, so the cluster bin-packs poorly.

## Findings

- The system and user node pools sit below 30% average utilization.
- Most workloads lack CPU/memory requests and limits, defeating the cluster autoscaler.
- No spot node pool for the stateless storefront workers.

## Recommendations

| # | Recommendation | Owner | Confidence |
|---|---|---|---|
| R1 | Set right-sized requests/limits (VPA recommendations) so the autoscaler can bin-pack. | Alex Rivera | High |
| R2 | Add a spot node pool for stateless storefront workers. | Mei Tan | Medium |
| R3 | Re-evaluate node pool SKUs after pods are right-sized. | Alex Rivera | Medium |

## Related

Same cost-optimization theme as the [Contoso VM rightsizing review](../contoso/2026-06-05-vm-rightsizing-cost.md).
