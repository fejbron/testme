import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import { ManifestSchema, type Manifest } from "./schema";

/**
 * Thrown when a campaign manifest fails to parse as YAML or fails schema
 * validation. Carries a human-readable, multi-line message summarizing
 * every issue found.
 */
export class ManifestParseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ManifestParseError";
  }
}

function formatZodError(error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Campaign manifest failed validation:\n${lines.join("\n")}`;
}

/**
 * Parse raw YAML text into a validated campaign Manifest.
 * Throws ManifestParseError on YAML syntax errors or schema violations.
 */
export function parseManifest(yamlText: string): Manifest {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new ManifestParseError(`Campaign manifest is not valid YAML: ${cause}`, { cause: err });
  }

  const result = ManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new ManifestParseError(formatZodError(result.error), { cause: result.error });
  }

  return result.data;
}
