import { z } from "zod";
import { EntitySchema } from "./entity.schema.js";
import { RelationshipSchema } from "./relationship.schema.js";

export const WorldCreatedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
});

export const WorldCreatedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("WORLD_CREATED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: WorldCreatedEventPayloadSchema,
});

export type WorldCreatedEvent = z.infer<typeof WorldCreatedEventSchema>;

export const EntityCreatedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  entity: EntitySchema,
});

export const EntityCreatedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("ENTITY_CREATED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: EntityCreatedEventPayloadSchema,
});

export type EntityCreatedEvent = z.infer<typeof EntityCreatedEventSchema>;

export const EntityUpdatedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  entityId: z.string().min(1),
  properties: z.record(z.unknown()),
  previousProperties: z.record(z.unknown()),
});

export const EntityUpdatedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("ENTITY_UPDATED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: EntityUpdatedEventPayloadSchema,
});

export type EntityUpdatedEvent = z.infer<typeof EntityUpdatedEventSchema>;

export const EntityDeletedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  entityId: z.string().min(1),
});

export const EntityDeletedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("ENTITY_DELETED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: EntityDeletedEventPayloadSchema,
});

export type EntityDeletedEvent = z.infer<typeof EntityDeletedEventSchema>;

export const RelationshipCreatedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  relationship: RelationshipSchema,
});

export const RelationshipCreatedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("RELATIONSHIP_CREATED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: RelationshipCreatedEventPayloadSchema,
});

export type RelationshipCreatedEvent = z.infer<typeof RelationshipCreatedEventSchema>;

export const RelationshipDeletedEventPayloadSchema = z.object({
  worldId: z.string().min(1),
  relationshipId: z.string().min(1),
});

export const RelationshipDeletedEventSchema = z.object({
  eventId: z.string().uuid(),
  worldId: z.string().min(1),
  type: z.literal("RELATIONSHIP_DELETED"),
  timestamp: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  payload: RelationshipDeletedEventPayloadSchema,
});

export type RelationshipDeletedEvent = z.infer<typeof RelationshipDeletedEventSchema>;

export const EventSchema = z.discriminatedUnion("type", [
  WorldCreatedEventSchema,
  EntityCreatedEventSchema,
  EntityUpdatedEventSchema,
  EntityDeletedEventSchema,
  RelationshipCreatedEventSchema,
  RelationshipDeletedEventSchema,
]);

export type MayaEvent = z.infer<typeof EventSchema>;