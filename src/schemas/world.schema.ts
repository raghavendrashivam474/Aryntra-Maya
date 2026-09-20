import { z } from "zod";
import { EntitySchema } from "./entity.schema.js";
import { RelationshipSchema } from "./relationship.schema.js";

export const WorldMetadataSchema = z.object({
  name: z.string().min(1, "World name must not be empty"),
  description: z.string().optional().default(""),
});

export type WorldMetadata = z.infer<typeof WorldMetadataSchema>;

export const WorldStateSchema = z.object({
  entities: z.record(EntitySchema).default({}),
  relationships: z.record(RelationshipSchema).default({}),
});

export type WorldState = z.infer<typeof WorldStateSchema>;

export const WorldSchema = z.object({
  id: z.string().min(1, "World id must not be empty"),
  schemaVersion: z.number().int().positive().default(1),
  metadata: WorldMetadataSchema,
  state: WorldStateSchema.default({ entities: {}, relationships: {} }),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now()),
});

export type World = z.infer<typeof WorldSchema>;

export const CreateWorldInputSchema = z.object({
  id: z.string().min(1, "World id must not be empty"),
  name: z.string().min(1, "World name must not be empty"),
  description: z.string().optional().default(""),
});

export type CreateWorldInput = z.infer<typeof CreateWorldInputSchema>;