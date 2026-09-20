# ADR-0002 — Automatic Cascading Deletion of Affected Relationships

## Status
Accepted

## Context
When an Entity is deleted using the `DELETE_ENTITY` command, there may be existing relationships in the world that reference this entity as either their `sourceEntityId` or `targetEntityId` (e.g., `Mira --knows--> Arin`). Leaving these relationships intact would cause "dangling relationships" pointing to non-existent entities, breaking referential integrity and leading to runtime query failures.

## Existing Behavior
In S0, there were no relationships, so entity deletion did not need to consider referential integrity boundaries.

## Problem
How should the World Runtime handle relationships when one of their endpoint entities is deleted?

## Options Considered
1. **Option A: Reject Deletion (Strict Invariant)**  
   If any relationship references the entity, reject the `DELETE_ENTITY` command with a domain failure. The user must manually find and delete all relationships first.
   * *Con:* Extremely tedious for consumers; creates heavy coupling and sequence dependency.

2. **Option B: Automatic Cascade Deletion (Preferred)**  
   Delete the entity and automatically remove all relationships where the deleted entity is either the `source` or `target`.
   * *Pro:* Keeps the world state clean and consistent. High developer experience. Ensures zero dangling relationships.
   * *Con:* Quietly deletes relationships; must emit events for visibility.

3. **Option C: Allow Dangling Relationships**  
   Delete the entity but leave the relationships alone.
   * *Con:* Violates referential integrity; breaks domain invariant assertions during queries.

## Decision
We choose **Option B: Automatic Cascade Deletion**. 

When `DELETE_ENTITY` executes:
1. The Entity is removed from the world state.
2. All Relationships where `sourceEntityId === entityId` or `targetEntityId === entityId` are identified.
3. For each affected relationship, we remove it from the world state and emit a `RELATIONSHIP_DELETED` event alongside the `ENTITY_DELETED` event.

## Rationale
This choice balances strict referential integrity with ease of use. It guarantees that any relationship query (`GET_RELATIONSHIP`, `LIST_RELATIONSHIPS`) can safely assume both endpoint entities exist in the state, avoiding the need for complex, repetitive defensive checks in downstream query and visualization code.

## Consequences
* **Improvement:** Strong referential integrity guarantees in the state.
* **Complexity:** Executing `DELETE_ENTITY` can now result in multiple events being returned (`ENTITY_DELETED` plus zero or more `RELATIONSHIP_DELETED` events).
* **Migration:** No S0 migration is required since S0 worlds contain no relationships.

## Rollback
If a "soft delete" or a "block deletion" pattern is needed in future sprints, this can be changed by modifying the delete handler in `WorldRuntime` and updating the ADR.