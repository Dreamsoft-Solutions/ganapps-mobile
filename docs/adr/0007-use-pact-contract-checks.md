# ADR 0007: Use Pact Contract Checks

**Date:** 2026-11-03
**Status:** Accepted

## Context

Mobile calls the server directly. The requested test policy replaces the existing automated tests with Pact contracts, matching web and server.

## Decision

Mobile generates a consumer contract from its API client. Mobile and server CI verify that contract against the server using read-only repository access.

## Alternatives Considered

1. **Keep the existing tests alongside Pact** — this retains broader coverage but does not meet the requested test policy.
2. **Run a Pact Broker** — this adds a service and credentials to the existing checkout-based workflow.

## Consequences

Pact checks only the interactions in the contract. It does not replace coverage of native UI, accessibility, release configuration, database writes, or live integrations. Provider verification uses persistence and external-service fixtures. CI requires access to the other private repository and fails if it cannot verify the contract.
