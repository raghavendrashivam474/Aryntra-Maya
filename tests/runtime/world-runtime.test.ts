import { describe, it, expect, beforeEach } from "vitest";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import type { World } from "../../src/schemas/world.schema.js";
import type { Entity } from "../../src/schemas/entity.schema.js";

describe("WorldRuntime", () => {
  let store: InMemoryWorldStore;
  let runtime: WorldRuntime;

  beforeEach(() => {
    store = new InMemoryWorldStore();
    runtime = new WorldRuntime(store);
  });

  describe("Commands", () => {
    it("should execute CREATE_WORLD command and emit WORLD_CREATED event", async () => {
      const result = await runtime.execute<World>({
        type: "CREATE_WORLD",
        payload: {
          worldId: "maya-alpha",
          name: "Alpha World",
          description: "First test world",
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("maya-alpha");
        expect(result.data.metadata.name).toBe("Alpha World");
        expect(result.event.type).toBe("WORLD_CREATED");
        expect(result.event.worldId).toBe("maya-alpha");
      }

      const storedWorld = await store.getWorld("maya-alpha");
      expect(storedWorld).not.toBeNull();
      expect(storedWorld?.id).toBe("maya-alpha");
    });

    it("should reject duplicate world creation", async () => {
      await runtime.execute({
        type: "CREATE_WORLD",
        payload: { worldId: "maya-alpha", name: "Alpha World" },
      });

      const duplicateResult = await runtime.execute({
        type: "CREATE_WORLD",
        payload: { worldId: "maya-alpha", name: "Alpha World 2" },
      });

      expect(duplicateResult.success).toBe(false);
      if (!duplicateResult.success) {
        expect(duplicateResult.error).toContain("already exists");
      }
    });

    it("should execute CREATE_ENTITY command and emit ENTITY_CREATED event", async () => {
      // First create world
      await runtime.execute({
        type: "CREATE_WORLD",
        payload: { worldId: "maya-alpha", name: "Alpha World" },
      });

      // Create entity
      const result = await runtime.execute<Entity>({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-alpha",
          entity: {
            id: "ent-mira",
            type: "character",
            properties: { name: "Mira", role: "Explorer" },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("ent-mira");
        expect(result.data.type).toBe("character");
        expect(result.data.properties).toEqual({ name: "Mira", role: "Explorer" });
        expect(result.event.type).toBe("ENTITY_CREATED");
      }

      // Check persisted world state
      const world = await store.getWorld("maya-alpha");
      expect(world?.state.entities["ent-mira"]).toBeDefined();
    });

    it("should fail creating entity in non-existent world", async () => {
      const result = await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "ghost-world",
          entity: { id: "ent-1", type: "item" },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("does not exist");
      }
    });

    it("should fail creating entity with duplicate ID in same world", async () => {
      await runtime.execute({
        type: "CREATE_WORLD",
        payload: { worldId: "maya-alpha", name: "Alpha World" },
      });

      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-alpha",
          entity: { id: "ent-1", type: "item" },
        },
      });

      const duplicateResult = await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-alpha",
          entity: { id: "ent-1", type: "item" },
        },
      });

      expect(duplicateResult.success).toBe(false);
      if (!duplicateResult.success) {
        expect(duplicateResult.error).toContain("already exists in world");
      }
    });
  });

  describe("Queries", () => {
    beforeEach(async () => {
      await runtime.execute({
        type: "CREATE_WORLD",
        payload: { worldId: "maya-query-test", name: "Query Test World" },
      });

      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-query-test",
          entity: { id: "c1", type: "character", properties: { name: "Mira" } },
        },
      });

      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-query-test",
          entity: { id: "i1", type: "item", properties: { name: "Artifact" } },
        },
      });
    });

    it("should query world via GET_WORLD", async () => {
      const world = await runtime.query<World>({
        type: "GET_WORLD",
        payload: { worldId: "maya-query-test" },
      });

      expect(world).not.toBeNull();
      expect(world?.id).toBe("maya-query-test");
    });

    it("should query single entity via GET_ENTITY", async () => {
      const entity = await runtime.query<Entity>({
        type: "GET_ENTITY",
        payload: { worldId: "maya-query-test", entityId: "c1" },
      });

      expect(entity).not.toBeNull();
      expect(entity?.id).toBe("c1");
      expect(entity?.type).toBe("character");
    });

    it("should list all entities via LIST_ENTITIES", async () => {
      const entities = await runtime.query<Entity[]>({
        type: "LIST_ENTITIES",
        payload: { worldId: "maya-query-test" },
      });

      expect(entities).toHaveLength(2);
    });

    it("should filter entities by type in LIST_ENTITIES", async () => {
      const characters = await runtime.query<Entity[]>({
        type: "LIST_ENTITIES",
        payload: { worldId: "maya-query-test", type: "character" },
      });

      expect(characters).toHaveLength(1);
      expect(characters?.[0].id).toBe("c1");
    });
  });
});