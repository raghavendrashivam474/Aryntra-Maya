import { z } from "zod";

export const RelationshipSchema = z.object({
  id: z.string().min(1, "Relationship id must not be empty"),
  sourceEntityId: z.string().min(1, "Source entity id must not be empty"),
  targetEntityId: z.string().min(1, "Target entity id must not be empty"),
  type: z.string().min(1, "Relationship type must not be empty"),
  properties: z.record(z.unknown()).default({}),
  schemaVersion: z.number().int().positive().default(1),
  createdAt: z.number().int().positive().default(() => Date.now()),
  updatedAt: z.number().int().positive().default(() => Date.now()),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

export const CreateRelationshipInputSchema = z.object({
  id: z.string().min(1, "Relationship id must not be empty"),
  sourceEntityId: z.string().min(1, "Source entity id must not be empty"),
  targetEntityId: z.string().min(1, "Target entity id must not be empty"),
  type: z.string().min(1, "Relationship type must not be empty"),
  properties: z.record(z.unknown()).optional().default({}),
});

export type CreateRelationshipInput = z.infer<typeof CreateRelationshipInputSchema>;