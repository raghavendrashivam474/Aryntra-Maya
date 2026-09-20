# Maya Evolution Principles

This document defines the rules governing how Aryntra Maya evolves over time.

---

## 1. Prime Directive

> ### **Nothing is permanent by default.**

Every component in Maya must be designed with the expectation that it may be replaced, upgraded, or completely rewritten in another technology or pattern.

Potentially replaceable components:
- UI framework (React, WebGL, CLI, native desktop)
- Runtime engine (TypeScript -> Rust / WASM)
- Persistence storage (In-memory -> IndexedDB -> SQLite -> Distributed)
- Schema definitions and versions
- Entity component models

---

## 2. Strong vs Rigid

```text
Strong  = Evolvable + Replaceable + Migratable + Versionable + Testable + Loosely coupled + Composable
```

- Strong architecture provides firm boundaries so internal implementations can be ripped out and replaced without 
  disturbing adjacent layers.
- Rigid architecture binds layers tightly together, making change costly and risky.

## 3. Evolution Rules

1. **Explicit Ports & Adapters**: Storage, network, and capabilities must sit behind interfaces (ports). Core domain 
   code never imports database drivers or UI libraries.
2. **Schema Versioning**: Every domain object that can be serialized must carry schema version information to 
   allow automated future migrations.
3. **CQRS Separation**: State changes must always occur through Commands; state inspection must always occur through Queries.
4. **No Silent Rewrites**: If an architectural pattern needs to be upgraded or replaced, document the rationale in 
   an Architecture Decision Record (ADR) first.

## 4. S1 Evolution Case Study (Backward Compatibility)

During Sprint S1, Maya evolved to support entity lifecycles and relationship models. This was achieved without breaking Sprint S0 foundations:
1. **Additive Domain Extensions**: New relationship types and schemas were introduced in separate modules (src/schemas/relationship.schema.ts).
2. **Signature Preservation**: Existing public API methods on WorldRuntime (execute, query, getEvents) were maintained exactly as defined in S0, ensuring downstream consumers suffered zero breaking changes.
3. **Automated Verification**: S0 test suites were left unmodified and continued to run alongside new S1 tests, proving perfect backward compatibility.

## 5. S2 Evolution Case Study (World Continuity)

During Sprint S2, Maya proved its prime directive of evolvability and replaceability by introducing durable persistence:
1. **Interface Preserved**: The WorldStore port established in S0 remained completely unchanged. The runtime was kept entirely decoupled from the underlying storage mechanism.
2. **Pluggable Architecture**: Maya now has two interchangeable persistence implementations (InMemoryWorldStore and IndexedDBWorldStore) satisfying the same behavioral contract.
3. **Validated Serialization Boundary**: By executing schema validation and version checks on load, Maya establishes a strict boundary. Untrusted raw database values are rejected before corrupting the active memory space of the runtime.
4. **Continuity Verification**: Vertical slice tests proved that the world state can seamlessly survive across multiple distinct, independent WorldRuntime lifetimes.

