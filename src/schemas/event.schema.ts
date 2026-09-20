import { z } from "zod";
import { EntitySchema } from "./entity.schema.js";

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

export const EventSchema = z.discriminatedUnion("type", [
  WorldCreatedEventSchema,
  EntityCreatedEventSchema,
]);

export type MayaEvent = z.infer<typeof EventSchema>;