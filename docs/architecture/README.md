# Maya Architecture Overview

This document outlines the high-level architecture and boundaries of Aryntra Maya.

---

## 1. System Topology

```text
                    INTERFACE
              Web / Desktop / CLI
                       │
                       ▼
                APPLICATION API
               Commands / Queries
                       │
                       ▼
                 WORLD RUNTIME
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   World Model     Event Model    Rule System
        │              │              │
        └──────────────┼──────────────┘
                       │
                  World State
                       │
              ┌────────┴────────┐
              ▼                 ▼
        Persistence        Capabilities
            Port                Port
              │                  │
       implementations    implementations
```

## 2. Core Layers & Responsibilities

### 1. Interface Layer

- **Role**: Web, CLI, Desktop, or external APIs.
- **Rule**: May invoke Application API via Commands/Queries. Never contains world domain logic or direct persistence code.

### 2. Application API (CQRS Separation)
**
- **Commands**: Explicit requests representing intent to mutate state (e.g., CreateEntityCommand).
- **Queries**: Pure read requests that observe state without side effects (e.g., GetEntityQuery).

### 3. World Runtime

- **Role**: The orchestration engine.
- **Workflow**:
      1. Validates incoming Command against schema.
      2. Loads target World from Persistence Port.
      3. Executes domain logic and updates State deterministically.
      4. Generates and emits domain Event (e.g., EntityCreatedEvent).
      5. Saves updated State to Persistence Port.
      6. Returns command execution result.

### 4. Domain Models (src/core/)

- **World**: Container identified by worldId, schema version, metadata, and state container.
- **Entity**: An object inside a world (id, type, generic properties).
- **Event**: An immutable fact recording what occurred (eventId, worldId, timestamp, type, payload).

### 5. Persistence Port (src/persistence/ports/)

- **Role**: Defines storage abstraction interface (WorldStore).
- **Implementations**:
      - InMemoryWorldStore (default for S0/S1, unit testing, environments without IndexedDB).
      - IndexedDBWorldStore (S2 durable adapter for browser-native persistence).
- **Contract Tests**: All implementations must satisfy the same behavioral contract (tests/persistence/world-store.contract.ts).
- **Serialization Boundary**: Data loaded from any adapter is treated as untrusted. Records are validated through Zod schemas (WorldSchema, EventSchema) and checked for supported schemaVersion before entering the runtime.
- **Persistence Errors**: Storage failures are wrapped in controlled error types (InitializationError, ReadError, WriteError, PersistenceValidationError, UnsupportedSchemaVersionError) to prevent raw storage exceptions from leaking into the runtime.

## 6. World Evolution & Relationships (S1 Extensions)

- **Entity Lifecycle Updates**:
  - UPDATE_ENTITY: Safely updates generic entity properties, preserving createdAt and tracking historical mutations via ENTITY_UPDATED events with previousProperties.
  - DELETE_ENTITY: Removes entities from world state.
- **Relationship Model**:
  - Generic directed graphs are established between arbitrary entities via Relationship models containing id, sourceEntityId, 	argetEntityId, and a dynamic property payload.
- **Referential Integrity Cascading (ADR-0002)**:
  - When an entity is deleted, any relationship that references it as a source or target is automatically purged from the world state to avoid dangling references, emitting corresponding RELATIONSHIP_DELETED events.

## 7. World Continuity & Persistence Lifecycle (S2)

- **Core Principle**: Runtime lifetime ≠ World lifetime. A world can survive the destruction of one WorldRuntime instance and be recovered by another.
- **Data Flow (Save)**: Command → Validation → WorldRuntime → State Transition → Event → WorldStore → Durable Storage.
- **Data Flow (Load)**: Durable Storage → Raw Data → Zod Validation → Schema Version Check → World → WorldRuntime.
- **Storage Independence**: WorldRuntime depends only on the WorldStore interface. It has zero knowledge of whether the underlying storage is RAM, IndexedDB, or any future adapter.


## 8. World Semantics & Query Foundation (S3)

- **Core Principle**: A World can be meaningfully inspected and queried through stable, deterministic contracts without mutating state or bypassing architectural boundaries.
- **Query Categories**:
  - **Entity Inspection**: `GET_ENTITY`, `LIST_ENTITIES`, `FIND_ENTITIES` (with optional type filter, property key/value equality, and property existence checks).
  - **Relationship Inspection**: `GET_RELATIONSHIP`, `LIST_RELATIONSHIPS` (with optional source, target, and type filters).
  - **Neighbor Traversal**: `GET_NEIGHBORS` returns connected entities via relationships, supporting `outgoing`, `incoming`, and `both` directions with optional relationship type filtering.
  - **Bounded Path Discovery**: `FIND_PATH` performs deterministic BFS traversal between two entities, bounded by `maxDepth` and optionally filtered by relationship type. Returns an entity ID chain or `null`.
- **Deterministic Ordering**: All list-based query results are sorted by entity/relationship ID using `localeCompare`, ensuring identical inputs always produce identical outputs regardless of insertion order or persistence implementation.
- **Read-Only Guarantee**: Queries never mutate world state, never emit events, and never trigger persistence writes. Mutation isolation is verified by comparing store snapshots before and after query execution.
- **No Persistence Changes**: S3 queries operate entirely through the existing `WorldStore.getWorld()` read path. No new persistence port methods were introduced. Both `InMemoryWorldStore` and `IndexedDBWorldStore` support S3 queries without modification.
- **No Architectural Changes**: S3 was implemented entirely within existing architectural seams (Case A). The `WorldRuntime.query()` method and `QuerySchema` discriminated union were extended additively. No ADR was required.
- **CQRS Preservation**: The command/query boundary remains strict. Commands mutate and emit events. Queries observe and return data. The `query()` return type (`T | null`) was preserved from S0–S2 to maintain backward compatibility with all existing consumers.
