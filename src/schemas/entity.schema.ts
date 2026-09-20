import { z } from "zod";

export const EntitySchema = z.object({
  id: z.string().min(1, "Entity id must not be empty"),
  type: z.string().min(1, "Entity type must not be empty"),
  properties: z.record(z.unknown()).default({}),
  schemaVersion: z.number().int().positive().default(1),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now()),
});

export type Entity = z.infer<typeof EntitySchema>;

export const CreateEntityInputSchema = z.object({
  id: z.string().min(1, "Entity id must not be empty"),
  type: z.string().min(1, "Entity type must not be empty"),
  properties: z.record(z.unknown()).optional().default({}),
});

export type CreateEntityInput = z.infer<typeof CreateEntityInputSchema>;