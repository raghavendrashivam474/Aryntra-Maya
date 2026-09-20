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
      - InMemoryWorldStore (default for S0, unit testing).
      -Future adapters: IndexedDB, SQLite, PostgreSQL.