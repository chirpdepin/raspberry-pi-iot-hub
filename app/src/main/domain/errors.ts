/**
 * Domain errors.
 *
 * Contract 1: `domain/` imports nothing. These types are what use cases return
 * instead of throwing raw adapter errors, and they exist so the renderer can
 * satisfy Contract 2 rule 2 — every failure maps to a cause and a next action,
 * never a raw `ECONNREFUSED`.
 *
 * `technicalDetail` is the original message, shown only behind
 * [Technical details] for support.
 */

export type ErrorCode =
  | 'docker-not-installed'
  | 'docker-not-running'
  | 'docker-unreachable'
  | 'permission-denied'
  | 'not-supported-on-platform'
  | 'unknown';

export interface DomainError {
  code: ErrorCode;
  /** English text, used directly as the i18n key (Contract 5). */
  message: string;
  technicalDetail?: string;
}

export const domainError = (code: ErrorCode, message: string, technicalDetail?: string): DomainError => ({
  code,
  message,
  technicalDetail,
});

/**
 * Result rather than exceptions across the IPC boundary: an Error does not
 * survive structured cloning with its type intact, so a thrown adapter error
 * reaches the renderer as a bare string and the mapping in Contract 2 rule 2
 * becomes impossible.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(error: DomainError): Result<T> => ({ ok: false, error });
