import { z } from "zod";
import { CreateEntityInputSchema } from "./entity.schema.js";
import { CreateRelationshipInputSchema } from "./relationship.schema.js";

export const CreateWorldCommandSchema = z.object({
  type: z.literal("CREATE_WORLD"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    name: z.string().min(1, "World name must not be empty"),
    description: z.string().optional().default(""),
  }),
});

export type CreateWorldCommand = z.infer<typeof CreateWorldCommandSchema>;

export const CreateEntityCommandSchema = z.object({
  type: z.literal("CREATE_ENTITY"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    entity: CreateEntityInputSchema,
  }),
});

export type CreateEntityCommand = z.infer<typeof CreateEntityCommandSchema>;

export const UpdateEntityCommandSchema = z.object({
  type: z.literal("UPDATE_ENTITY"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    entityId: z.string().min(1, "Entity id must not be empty"),
    properties: z.record(z.unknown()),
  }),
});

export type UpdateEntityCommand = z.infer<typeof UpdateEntityCommandSchema>;

export const DeleteEntityCommandSchema = z.object({
  type: z.literal("DELETE_ENTITY"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    entityId: z.string().min(1, "Entity id must not be empty"),
  }),
});

export type DeleteEntityCommand = z.infer<typeof DeleteEntityCommandSchema>;

export const CreateRelationshipCommandSchema = z.object({
  type: z.literal("CREATE_RELATIONSHIP"),
  payload: z.object({
    worldId: z.string().min(1, "World id must not be empty"),
    relationship: CreateRelationshipInputSchema,
  }),
});

export type CreateRelationshipCommand = z.infer<typeof CreateRelationshipCommandSchema>;

export const CommandSchema = z.discriminatedUnion("type", [
  CreateWorldCommandSchema,
  CreateEntityCommandSchema,
  UpdateEntityCommandSchema,
  DeleteEntityCommandSchema,
  CreateRelationshipCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;