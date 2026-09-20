import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryWorldStore } from "../../src/persistence/memory/in-memory-world-store.js";
import { WorldRuntime } from "../../src/runtime/world-runtime.js";
import type { Entity } from "../../src/schemas/entity.schema.js";
import type { Relationship } from "../../src/schemas/relationship.schema.js";

describe("WorldRuntime - S1 Features", () => {
  let store: InMemoryWorldStore;
  let runtime: WorldRuntime;
  const worldId = "s1-test-world";

  beforeEach(async () => {
    store = new InMemoryWorldStore();
    runtime = new WorldRuntime(store);
    await runtime.execute({
      type: "CREATE_WORLD",
      payload: { worldId, name: "S1 World" },
    });
  });

  describe("Entity Lifecycle (Update & Delete)", () => {
    beforeEach(async () => {
      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId,
          entity: { id: "mira", type: "character", properties: { status: "idle" } },
        },
      });
    });

    it("should successfully update entity properties and emit ENTITY_UPDATED", async () => {
      const updateResult = await runtime.execute<Entity>({
        type: "UPDATE_ENTITY",
        payload: {
          worldId,
          entityId: "mira",
          properties: { status: "active", energy: 100 },
        },
      });

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.data.properties).toEqual({
          status: "active",
          energy: 100,
        });
        expect(updateResult.event.type).toBe("ENTITY_UPDATED");
        expect((updateResult.event.payload as any).previousProperties).toEqual({
          status: "idle",
        });
      }

      // Query verification
      const entity = await runtime.query<Entity>({
        type: "GET_ENTITY",
        payload: { worldId, entityId: "mira" },
      });
      expect(entity?.properties).toEqual({ status: "active", energy: 100 });
    });

    it("should return controlled failure on updating non-existent entity", async () => {
      const result = await runtime.execute({
        type: "UPDATE_ENTITY",
        payload: {
          worldId,
          entityId: "nobody",
          properties: { status: "active" },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("does not exist in world");
      }
    });

    it("should successfully delete entity and emit ENTITY_DELETED", async () => {
      const result = await runtime.execute<Entity>({
        type: "DELETE_ENTITY",
        payload: { worldId, entityId: "mira" },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("mira");
        expect(result.event.type).toBe("ENTITY_DELETED");
      }

      // Query verification
      const entity = await runtime.query<Entity>({
        type: "GET_ENTITY",
        payload: { worldId, entityId: "mira" },
      });
      expect(entity).toBeNull();
    });

    it("should return controlled failure on deleting non-existent entity", async () => {
      const result = await runtime.execute({
        type: "DELETE_ENTITY",
        payload: { worldId, entityId: "nobody" },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("does not exist in world");
      }
    });
  });

  describe("Relationships & Cascades", () => {
    beforeEach(async () => {
      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId,
          entity: { id: "mira", type: "character" },
        },
      });
      await runtime.execute({
        type: "CREATE_ENTITY",
        payload: {
          worldId,
          entity: { id: "arin", type: "character" },
        },
      });
    });

    it("should create relationship and emit RELATIONSHIP_CREATED", async () => {
      const result = await runtime.execute<Relationship>({
        type: "CREATE_RELATIONSHIP",
        payload: {
          worldId,
          relationship: {
            id: "mira-arin-knows",
            sourceEntityId: "mira",
            targetEntityId: "arin",
            type: "knows",
            properties: { level: 5 },
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("mira-arin-knows");
        expect(result.event.type).toBe("RELATIONSHIP_CREATED");
      }

      // Query single relationship
      const rel = await runtime.query<Relationship>({
        type: "GET_RELATIONSHIP",
        payload: { worldId, relationshipId: "mira-arin-knows" },
      });
      expect(rel).toBeDefined();
      expect(rel?.sourceEntityId).toBe("mira");
      expect(rel?.targetEntityId).toBe("arin");
    });

    it("should reject relationship if source entity does not exist", async () => {
      const result = await runtime.execute({
        type: "CREATE_RELATIONSHIP",
        payload: {
          worldId,
          relationship: {
            id: "nobody-arin",
            sourceEntityId: "nobody",
            targetEntityId: "arin",
            type: "knows",
          },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Source entity 'nobody' does not exist");
      }
    });

    it("should reject relationship if target entity does not exist", async () => {
      const result = await runtime.execute({
        type: "CREATE_RELATIONSHIP",
        payload: {
          worldId,
          relationship: {
            id: "mira-nobody",
            sourceEntityId: "mira",
            targetEntityId: "nobody",
            type: "knows",
          },
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Target entity 'nobody' does not exist");
      }
    });

    it("should list and filter relationships", async () => {
      await runtime.execute({
        type: "CREATE_RELATIONSHIP",
        payload: {
          worldId,
          relationship: {
            id: "mira-arin-knows",
            sourceEntityId: "mira",
            targetEntityId: "arin",
            type: "knows",
          },
        },
      });

      const listAll = await runtime.query<Relationship[]>({
        type: "LIST_RELATIONSHIPS",
        payload: { worldId },
      });
      expect(listAll).toHaveLength(1);

      const listFilterEmpty = await runtime.query<Relationship[]>({
        type: "LIST_RELATIONSHIPS",
        payload: { worldId, type: "nonexistent-type" },
      });
      expect(listFilterEmpty).toHaveLength(0);
    });

    it("should automatically cascade-delete relationships when an endpoint entity is deleted (ADR-0002)", async () => {
      // Create relationship
      await runtime.execute({
        type: "CREATE_RELATIONSHIP",
        payload: {
          worldId,
          relationship: {
            id: "mira-arin-knows",
            sourceEntityId: "mira",
            targetEntityId: "arin",
            type: "knows",
          },
        },
      });

      // Verify relationship exists
      const initialRel = await runtime.query<Relationship>({
        type: "GET_RELATIONSHIP",
        payload: { worldId, relationshipId: "mira-arin-knows" },
      });
      expect(initialRel).not.toBeNull();

      // Delete "arin" (target entity)
      const deleteResult = await runtime.execute({
        type: "DELETE_ENTITY",
        payload: { worldId, entityId: "arin" },
      });

      expect(deleteResult.success).toBe(true);

      // Verify arin is gone
      const arin = await runtime.query({
        type: "GET_ENTITY",
        payload: { worldId, entityId: "arin" },
      });
      expect(arin).toBeNull();

      // Verify relationship is automatically deleted from state
      const relAfterCascade = await runtime.query({
        type: "GET_RELATIONSHIP",
        payload: { worldId, relationshipId: "mira-arin-knows" },
      });
      expect(relAfterCascade).toBeNull();

      // Verify we emitted both ENTITY_DELETED and RELATIONSHIP_DELETED events
      const events = await runtime.getEvents(worldId);
      const deletedEventTypes = events.map((e) => e.type);
      expect(deletedEventTypes).toContain("ENTITY_DELETED");
      expect(deletedEventTypes).toContain("RELATIONSHIP_DELETED");
    });
  });
});