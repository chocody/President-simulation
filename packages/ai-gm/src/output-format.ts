// Structured-output format for a zod schema.
//
// `zodOutputFormat` from the SDK (checked in @anthropic-ai/sdk 1.1.0) moves every JSON-schema `enum` into the
// field's description text instead of emitting it as a real `enum`. The model then sees the allowed values only as
// prose and constrained decoding does not enforce them. The judge's `indicator`, `level` and score fields are all
// enums, so we put the enums back after the SDK's transform. Everything else stays as the SDK produced it.
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

type Json = Record<string, any>;

function restoreEnums(orig: Json | undefined, out: Json | undefined): void {
  if (!orig || !out || typeof orig !== "object" || typeof out !== "object") return;
  if (Array.isArray(orig.enum)) {
    out.enum = orig.enum;
    if (typeof out.description === "string" && /^\{enum: \[.*\]\}$/s.test(out.description)) delete out.description;
  }
  for (const key of ["$defs", "properties"]) {
    for (const [k, v] of Object.entries((orig[key] ?? {}) as Json)) restoreEnums(v, out[key]?.[k]);
  }
  restoreEnums(orig.items, out.items);
  // The SDK rewrites oneOf as anyOf, keeping the order.
  const variants: Json[] | undefined = orig.anyOf ?? orig.oneOf;
  variants?.forEach((v, i) => restoreEnums(v, out.anyOf?.[i]));
}

export function outputFormat<S extends z.ZodType>(schema: S): ReturnType<typeof zodOutputFormat<S>> {
  const fmt = zodOutputFormat(schema);
  restoreEnums(z.toJSONSchema(schema, { reused: "ref" }) as Json, fmt.schema as Json);
  return fmt;
}
