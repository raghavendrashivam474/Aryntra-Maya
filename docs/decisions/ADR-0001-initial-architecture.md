# ADR-0001: Initial Architecture and Foundation Decisions

- **Status:** Accepted
- **Date:** 2025-02-23
- **Context:** Sprint S0 — Foundation & First World Runtime

---

## 1. Context

Aryntra Maya is a long-term engine for persistent, interactive digital worlds. Maya requires an architecture capable of evolving over many years. Early decisions must avoid painting the system into a corner while keeping the initial vertical slice lightweight and testable.

---

## 2. Decisions

### Decision 1: Modular Monolith in Early Sprints
- **Rationale:** We adopt a clean modular monolith structure (`core`, `runtime`, `persistence`, `schemas`). Microservices or distributed runtimes at this stage would introduce premature network and operational complexity.

### Decision 2: TypeScript & Zod for S0
- **Rationale:** TypeScript provides rapid iteration speed and type safety. Zod provides runtime validation and single-source-of-truth schema definitions, ensuring runtime state and data boundaries are always strictly validated.

### Decision 3: Persistence Behind a Port (`WorldStore`)
- **Rationale:** The World Engine must not couple to any specific database engine. In S0, `InMemoryWorldStore` is the primary persistence adapter to make unit tests lightning-fast and deterministic. Future adapters (IndexedDB, SQLite, Postgres) can be plugged in without changing domain logic.

### Decision 4: UI Independence
- **Rationale:** World Engine domain logic, state transformations, and event emissions must have zero dependencies on browser DOM, React, WebGL, or CLI harnesses. The engine can run in Node.js, Web Workers, native containers, or tests without UI scaffolding.

### Decision 5: Deferral of Rust / Tauri / SQLite / AI / Distributed Networks
- **Rationale:** While future iterations may migrate parts of the core engine to Rust or introduce desktop packaging (Tauri) or relational storage (SQLite), introducing them now creates unnecessary friction. Boundaries are designed to allow these technologies to be introduced seamlessly later.

### Decision 6: Explicit Evolvable Architecture
- **Rationale:** "Nothing is permanent by default." All stateful entities carry schema versions, and state mutations are strictly separated into Commands (intent) and Events (facts) to allow future event sourcing, replayability, and data migration.

---

## 3. Consequences

- **Positive:** Rapid development cycle, zero heavy external infrastructure needed for tests, clean interfaces, easily swappable adapters.
- **Negative:** Eventual migration to compiled native runtimes (e.g. Rust) will require porting the TypeScript domain logic, but port contracts will remain identical.