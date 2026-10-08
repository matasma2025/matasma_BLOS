import React from "react";
import { displayNameSchema, NAME_CHARACTERS_HINT } from "@shared/inputValidators";

export function nameError(value: string, label = "Name", max = 200): string | null {
  const result = displayNameSchema(label, max).safeParse(value);
  return result.success ? null : result.error.issues[0]?.message || "Invalid name";
}

export function readableValidationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unable to save. Please try again.";
  try {
    const body = JSON.parse(message.replace(/^\d{3}:\s*/, ""));
    return typeof body.error === "string" ? body.error : message;
  } catch {
    return message;
  }
}

export function NameFieldFeedback({ value, label = "Name", max = 200, id }: {
  value: string; label?: string; max?: number; id: string;
}) {
  const error = nameError(value, label, max);
  return <p id={id} role={error ? "alert" : undefined}
    className={`mt-1 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
    {error || NAME_CHARACTERS_HINT}
  </p>;
}
