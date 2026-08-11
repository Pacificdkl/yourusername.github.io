# 0001 — Record architecture decisions

- Status: accepted
- Date: 2026-08-11

## Context

CLAUDE.md §7 requires "a short note in `docs/decisions/`" at the end of each
phase, and §5 requires a written reason if `boundary_answers` /
`session_draws` are stored server-readable.

## Decision

We keep lightweight ADRs (Architecture Decision Records) in this directory, one
file per decision, numbered sequentially. Each records context, the decision,
and consequences. Superseded ADRs are kept and marked, not deleted.

## Consequences

Every phase ends with an ADR. Reviewers can reconstruct *why* from this
directory without reading git archaeology.
