/**
 * Lightweight input validation helpers — no external schema library needed.
 *
 * Usage:
 *   const errs = validate(req.body, {
 *     project_path: [required, isString, maxLen(512)],
 *     environment_id: [optional, isUUID],
 *   });
 *   if (errs.length) return res.status(400).json({ errors: errs });
 */

export type Validator = (value: unknown, field: string) => string | null;

// ── Primitives ────────────────────────────────────────────────────────────────

export const required: Validator = (v, f) =>
  v === undefined || v === null || v === '' ? `${f} is required` : null;

export const optional: Validator = () => null; // always passes — used as a marker

export const isString: Validator = (v, f) =>
  typeof v !== 'string' ? `${f} must be a string` : null;

export const isNumber: Validator = (v, f) =>
  typeof v !== 'number' ? `${f} must be a number` : null;

export const isBoolean: Validator = (v, f) =>
  typeof v !== 'boolean' ? `${f} must be a boolean` : null;

export const maxLen =
  (n: number): Validator =>
  (v, f) =>
    typeof v === 'string' && v.length > n ? `${f} must be at most ${n} characters` : null;

export const minLen =
  (n: number): Validator =>
  (v, f) =>
    typeof v === 'string' && v.length < n ? `${f} must be at least ${n} characters` : null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUUID: Validator = (v, f) =>
  typeof v === 'string' && UUID_RE.test(v) ? null : `${f} must be a valid UUID`;

// No path traversal — reject strings containing ../ or ..\
const PATH_TRAVERSAL_RE = /\.\.[/\\]/;
export const noPathTraversal: Validator = (v, f) =>
  typeof v === 'string' && PATH_TRAVERSAL_RE.test(v)
    ? `${f} must not contain path traversal sequences`
    : null;

export const oneOf =
  (values: string[]): Validator =>
  (v, f) =>
    typeof v === 'string' && values.includes(v)
      ? null
      : `${f} must be one of: ${values.join(', ')}`;

// ── Runner ────────────────────────────────────────────────────────────────────

export function validate(
  body: Record<string, unknown>,
  schema: Record<string, Validator[]>,
): string[] {
  const errors: string[] = [];
  for (const [field, validators] of Object.entries(schema)) {
    const value = body[field];
    for (const validator of validators) {
      const error = validator(value, field);
      if (error) {
        errors.push(error);
        break; // stop at first error per field
      }
    }
  }
  return errors;
}
