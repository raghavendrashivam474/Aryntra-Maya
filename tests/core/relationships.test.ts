import { describe, it, expect } from "vitest";
import { RelationshipSchema } from "../../src/schemas/relationship.schema.js";

describe("Relationship Schema", () => {
  it("should validate a valid relationship", () => {
    const rel = {
      id: "mira-arin-knows",
      sourceEntityId: "mira",
      targetEntityId: "arin",
      type: "knows",
      properties: { level: 10 },
    };
    const result = RelationshipSchema.safeParse(rel);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("mira-arin-knows");
      expect(result.data.sourceEntityId).toBe("mira");
      expect(result.data.targetEntityId).toBe("arin");
      expect(result.data.type).toBe("knows");
      expect(result.data.properties).toEqual({ level: 10 });
      expect(result.data.schemaVersion).toBe(1);
      expect(result.data.createdAt).toBeTypeOf("number");
      expect(result.data.updatedAt).toBeTypeOf("number");
    }
  });

  it("should reject relationship with missing required fields", () => {
    const rel = {
      id: "mira-arin-knows",
      sourceEntityId: "mira",
      // missing targetEntityId and type
    };
    const result = RelationshipSchema.safeParse(rel);
    expect(result.success).toBe(false);
  });
});