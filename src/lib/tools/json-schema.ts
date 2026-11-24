// Minimal zod 3 → JSON Schema converter for the agent-tools manifest.
// Covers the zod types our tool inputs use; anything else becomes {}.
import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

export function toJsonSchema(schema: z.ZodTypeAny): JsonSchema {
  const out = convert(schema);
  if (schema.description && !out.description) out.description = schema.description;
  return out;
}

function convert(s: z.ZodTypeAny): JsonSchema {
  const d = s.description ? { description: s.description } : {};
  if (s instanceof z.ZodOptional || s instanceof z.ZodNullable) return { ...convert(s.unwrap()), ...d };
  if (s instanceof z.ZodDefault) return { ...convert(s._def.innerType), default: s._def.defaultValue(), ...d };
  if (s instanceof z.ZodEffects) return { ...convert(s.innerType()), ...d };
  if (s instanceof z.ZodString) return { type: "string", ...d };
  if (s instanceof z.ZodNumber) {
    const r: JsonSchema = { type: s.isInt ? "integer" : "number", ...d };
    if (s.minValue !== null) r.minimum = s.minValue;
    if (s.maxValue !== null) r.maximum = s.maxValue;
    return r;
  }
  if (s instanceof z.ZodBoolean) return { type: "boolean", ...d };
  if (s instanceof z.ZodLiteral) return { const: s.value, ...d };
  if (s instanceof z.ZodEnum) return { type: "string", enum: s.options, ...d };
  if (s instanceof z.ZodUnion) return { anyOf: (s.options as z.ZodTypeAny[]).map(convert), ...d };
  if (s instanceof z.ZodArray) {
    const r: JsonSchema = { type: "array", items: convert(s.element), ...d };
    if (s._def.minLength) r.minItems = s._def.minLength.value;
    if (s._def.maxLength) r.maxItems = s._def.maxLength.value;
    return r;
  }
  if (s instanceof z.ZodRecord) return { type: "object", additionalProperties: convert(s._def.valueType), ...d };
  if (s instanceof z.ZodObject) {
    const shape = s.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = convert(v);
      if (!v.isOptional()) required.push(k);
    }
    return { type: "object", properties, ...(required.length ? { required } : {}), ...d };
  }
  return { ...d };
}
