import { z } from "zod";
import { CreateEntityInputSchema } from "./entity.schema.js";

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

export const CommandSchema = z.discriminatedUnion("type", [
  CreateWorldCommandSchema,
  CreateEntityCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;