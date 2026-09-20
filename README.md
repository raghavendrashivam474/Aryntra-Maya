# Aryntra Maya

> **Maya** is a long-term engine for persistent, interactive digital worlds.

---

## What is Maya?

Maya is fundamentally:

```text
World + State + Entities + Events + Rules + Capabilities + Context
```

powered by a replaceable World Engine.

Maya is deliberately not currently defined as a game, an operating system, an AI assistant, or a distributed system. Those may become future experiences or capabilities.

## Core Philosophy

> Nothing is permanent by default.

Maya's architecture is built on the principle that strong ≠ rigid.

```text
Strong = Evolvable + Replaceable + Migratable + Versionable + Testable + Loosely coupled + Composable
```

Boundaries are placed to protect future evolution (such as swapping runtime engines, persistence engines, or interfaces) without forcing full rewrites.

Architecture Overview
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

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm (recommended) or npm

### Installation

```Bash
pnpm install
```

### Running Tests

```Bash
pnpm test
```

### Type Checking

```Bash
pnpm typecheck
```

## Sprint S0 Status

> S0 establishes the repository foundations, domain schemas, an in-memory persistence store, the World Runtime, and           end-to-end vertical-slice tests proving the world lifecycle:

```text
Create World →Create Entity → Command → Runtime → Event → Persist → Reload
```