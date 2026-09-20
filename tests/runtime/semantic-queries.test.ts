import { describe, test, expect, beforeEach } from "vitest";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { Entity } from "../../src/schemas/entity.schema.js";
import type { Relationship } from "../../src/schemas/relationship.schema.js";
import { QuerySchema } from "../../src/schemas/query.schema.js";

describe("S3 Semantic Queries", () => {
  let store: InMemoryWorldStore;
  let runtime: WorldRuntime;
  const worldId = "test-world-s3";

  beforeEach(async () => {
    store = new InMemoryWorldStore();
    runtime = new WorldRuntime(store);

    // Setup a robust semantic playground
    await runtime.execute({
      type: "CREATE_WORLD",
      payload: { worldId, name: "Semantic Playground" },
    });

    // Entities
    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "mira", type: "person", properties: { name: "Mira", age: 30, role: "Lead" } },
      },
    });

    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "arin", type: "person", properties: { name: "Arin", age: 25 } },
      },
    });

    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "company", type: "organization", properties: { name: "Anti-grav", sector: "Tech" } },
      },
    });

    await runtime.execute({
      type: "CREATE_ENTITY",
      payload: {
        worldId,
        entity: { id: "book", type: "item", properties: { title: "Maya Handbook" } },
      },
    });

    // Relationships
    await runtime.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-mira-knows-arin", sourceEntityId: "mira", targetEntityId: "arin", type: "knows" },
      },
    });

    await runtime.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-arin-works-company", sourceEntityId: "arin", targetEntityId: "company", type: "works_at" },
      },
    });

    await runtime.execute({
      type: "CREATE_RELATIONSHIP",
      payload: {
        worldId,
        relationship: { id: "rel-mira-owns-book", sourceEntityId: "mira", targetEntityId: "book", type: "owns" },
      },
    });
  });

  // ── 1. SCHEMA VALIDATION ────────────────────────────────────
  describe("Schema Validation", () => {
    test("should reject malformed queries", () => {
      const invalidQuery = {
        type: "FIND_ENTITIES",
        payload: {
          // worldId missing
          propertyKey: "name",
        },
      };
      const parse = QuerySchema.safeParse(invalidQuery);
      expect(parse.success).toBe(false);
    });

    test("should accept well-formed FIND_ENTITIES, GET_NEIGHBORS, and FIND_PATH", () => {
      expect(QuerySchema.safeParse({
        type: "FIND_ENTITIES",
        payload: { worldId, type: "person", propertyKey: "name", propertyValue: "Mira" }
      }).success).toBe(true);

      expect(QuerySchema.safeParse({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "mira", direction: "outgoing", relationshipType: "knows" }
      }).success).toBe(true);

      expect(QuerySchema.safeParse({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "company", maxDepth: 3 }
      }).success).toBe(true);
    });
  });

  // ── 2. FIND_ENTITIES ────────────────────────────────────────
  describe("FIND_ENTITIES", () => {
    test("should find entities by type and exact property match", async () => {
      const results = await runtime.query<Entity[]>({
        type: "FIND_ENTITIES",
        payload: { worldId, type: "person", propertyKey: "name", propertyValue: "Mira" },
      });

      expect(results).toHaveLength(1);
      expect(results![0].id).toBe("mira");
    });

    test("should find entities by property existence only when value is omitted", async () => {
      const results = await runtime.query<Entity[]>({
        type: "FIND_ENTITIES",
        payload: { worldId, propertyKey: "role" },
      });

      expect(results).toHaveLength(1);
      expect(results![0].id).toBe("mira"); // Only Mira has 'role'
    });

    test("should return empty list when no properties match", async () => {
      const results = await runtime.query<Entity[]>({
        type: "FIND_ENTITIES",
        payload: { worldId, propertyKey: "nonexistent-key" },
      });

      expect(results).toEqual([]);
    });
  });

  // ── 3. GET_NEIGHBORS ────────────────────────────────────────
  describe("GET_NEIGHBORS", () => {
    test("should fetch outgoing neighbors", async () => {
      const results = await runtime.query<Entity[]>({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "mira", direction: "outgoing" },
      });

      // Mira knows Arin, owns Book -> arin, book
      expect(results).toHaveLength(2);
      expect(results!.map(e => e.id)).toEqual(["arin", "book"]); // Sorted deterministically by ID
    });

    test("should fetch incoming neighbors", async () => {
      const results = await runtime.query<Entity[]>({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "arin", direction: "incoming" },
      });

      // Mira knows Arin -> mira
      expect(results).toHaveLength(1);
      expect(results![0].id).toBe("mira");
    });

    test("should filter neighbors by relationship type", async () => {
      const results = await runtime.query<Entity[]>({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "mira", direction: "outgoing", relationshipType: "owns" },
      });

      expect(results).toHaveLength(1);
      expect(results![0].id).toBe("book");
    });

    test("should return empty array for non-existent or isolated entity", async () => {
      const results = await runtime.query<Entity[]>({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "nonexistent" },
      });

      expect(results).toEqual([]);
    });
  });

  // ── 4. FIND_PATH ────────────────────────────────────────────
  describe("FIND_PATH", () => {
    test("should find a path via transitive relationships (BFS)", async () => {
      // mira -> knows -> arin -> works_at -> company
      const path = await runtime.query<string[]>({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "company" },
      });

      expect(path).toEqual(["mira", "arin", "company"]);
    });

    test("should return trivial path when source and target are identical", async () => {
      const path = await runtime.query<string[]>({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "mira" },
      });

      expect(path).toEqual(["mira"]);
    });

    test("should honor maxDepth limit", async () => {
      // Path is length 3 (edges = 2). If maxDepth = 1, it cannot find it
      const path = await runtime.query<string[]>({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "company", maxDepth: 1 },
      });

      expect(path).toBeNull();
    });

    test("should filter by relationship type along path", async () => {
      // The full path requires knows + works_at.
      // If we constrain relationshipType to "knows", it will fail to traverse to company.
      const path = await runtime.query<string[]>({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "company", relationshipType: "knows" },
      });

      expect(path).toBeNull();
    });
  });

  // ── 5. DETERMINISTIC ORDERING ───────────────────────────────
  describe("Determinism", () => {
    test("should stably sort results by ID", async () => {
      // Insert entities in non-alphabetical order
      const localWorldId = "det-world";
      await runtime.execute({ type: "CREATE_WORLD", payload: { worldId: localWorldId, name: "Det" } });

      await runtime.execute({ type: "CREATE_ENTITY", payload: { worldId: localWorldId, entity: { id: "z", type: "t" } } });
      await runtime.execute({ type: "CREATE_ENTITY", payload: { worldId: localWorldId, entity: { id: "a", type: "t" } } });
      await runtime.execute({ type: "CREATE_ENTITY", payload: { worldId: localWorldId, entity: { id: "m", type: "t" } } });

      const queryRun1 = await runtime.query<Entity[]>({
        type: "LIST_ENTITIES",
        payload: { worldId: localWorldId },
      });

      const queryRun2 = await runtime.query<Entity[]>({
        type: "LIST_ENTITIES",
        payload: { worldId: localWorldId },
      });

      expect(queryRun1!.map(e => e.id)).toEqual(["a", "m", "z"]);
      expect(queryRun1).toEqual(queryRun2); // Deterministic equality
    });
  });

  // ── 6. MUTATION ISOLATION ───────────────────────────────────
  describe("Mutation Isolation", () => {
    test("queries should strictly be read-only and must not modify store or trigger events", async () => {
      const worldBefore = await store.getWorld(worldId);
      const eventsBefore = await store.getEvents(worldId);

      // Execute deep queries
      await runtime.query({
        type: "FIND_PATH",
        payload: { worldId, sourceEntityId: "mira", targetEntityId: "company" },
      });
      await runtime.query({
        type: "GET_NEIGHBORS",
        payload: { worldId, entityId: "mira" },
      });

      const worldAfter = await store.getWorld(worldId);
      const eventsAfter = await store.getEvents(worldId);

      expect(worldBefore).toEqual(worldAfter);
      expect(eventsBefore).toEqual(eventsAfter);
    });
  });
});
