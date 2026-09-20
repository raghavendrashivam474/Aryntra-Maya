import { describe, it, expect } from "vitest";
import {
  EntitySchema,
  WorldSchema,
  CreateWorldCommandSchema,
  CreateEntityCommandSchema,
  EntityCreatedEventSchema,
} from "../../src/schemas/index.js";

describe("Core Schemas", () => {
  describe("EntitySchema", () => {
    it("should validate a valid entity", () => {
      const entity = {
        id: "ent-001",
        type: "character",
        properties: { name: "Mira" },
        schemaVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const parsed = EntitySchema.safeParse(entity);
      expect(parsed.success).toBe(true);
    });

    it("should reject an entity with empty id", () => {
      const entity = {
        id: "",
        type: "character",
        properties: {},
      };
      const parsed = EntitySchema.safeParse(entity);
      expect(parsed.success).toBe(false);
    });
  });

  describe("WorldSchema", () => {
    it("should validate a valid world with default state", () => {
      const world = {
        id: "maya-demo",
        metadata: {
          name: "Demo World",
          description: "A test world",
        },
      };
      const parsed = WorldSchema.safeParse(world);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.schemaVersion).toBe(1);
        expect(parsed.data.state.entities).toEqual({});
      }
    });

    it("should reject a world with empty name", () => {
      const world = {
        id: "maya-demo",
        metadata: {
          name: "",
        },
      };
      const parsed = WorldSchema.safeParse(world);
      expect(parsed.success).toBe(false);
    });
  });

  describe("Command Schemas", () => {
    it("should validate CreateEntityCommand", () => {
      const cmd = {
        type: "CREATE_ENTITY",
        payload: {
          worldId: "maya-demo",
          entity: {
            id: "ent-001",
            type: "character",
            properties: { name: "Mira" },
          },
        },
      };
      const parsed = CreateEntityCommandSchema.safeParse(cmd);
      expect(parsed.success).toBe(true);
    });
  });

  describe("Event Schemas", () => {
    it("should validate EntityCreatedEvent", () => {
      const event = {
        eventId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        worldId: "maya-demo",
        type: "ENTITY_CREATED",
        timestamp: Date.now(),
        schemaVersion: 1,
        payload: {
          worldId: "maya-demo",
          entity: {
            id: "ent-001",
            type: "character",
            properties: { name: "Mira" },
            schemaVersion: 1,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        },
      };
      const parsed = EntityCreatedEventSchema.safeParse(event);
      expect(parsed.success).toBe(true);
    });
  });
});