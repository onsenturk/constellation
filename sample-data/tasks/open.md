# Open Tasks (fictional)

Tracked actions across the portfolio. Grouped by customer.

> Note for the demo: the two recurring DR recommendations — *"adopt attach-before-hydration as a
> standard DR runbook step"* and *"validate the immutable lock period against the retention
> policy"* — are intentionally **absent** here, even though they appear in multiple reports. They
> should surface under "repeated recommendations not yet converted into tracked actions."

## Northwind Traders

- [ ] Use unique RMAN backup-piece handles per run to avoid immutability overwrite conflicts. (owner: Sam Okoye, due: 2026-06-16)
- [ ] Publish service-online vs. full-performance RTO numbers for the logistics database. (owner: Alex Rivera, due: 2026-06-18)

## Contoso Ltd

- [ ] Measure cross-region restore hydration time against the DR SLA. (owner: Alex Rivera, due: 2026-06-19)
- [ ] Rightsize the 18 under-utilized production VMs one tier down. (owner: Alex Rivera, due: 2026-06-20)
- [ ] Apply 1-year reservations to the steady-state VM fleet. (owner: Priya Nair, due: 2026-06-25)

## Fabrikam Inc

- [ ] Pre-warm latency-sensitive tablespaces after restore attach. (owner: Lars Berg, due: 2026-06-17)

## Tailwind Traders

- [ ] Adopt Entra ID (passwordless) auth on the PostgreSQL target. (owner: Mei Tan, due: 2026-06-22)
- [ ] Set right-sized requests/limits on AKS workloads (VPA). (owner: Alex Rivera, due: 2026-06-19)

## Proseware Inc

- [ ] Rebuild materialized views natively in PostgreSQL and validate refresh timings. (owner: Alex Rivera, due: 2026-06-24)
