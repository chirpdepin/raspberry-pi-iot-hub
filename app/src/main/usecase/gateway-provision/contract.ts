import type { Result } from '../../domain/errors';

/**
 * Writes credentials to disk and starts the gateway service.
 *
 * Separate from registration because a user may legitimately do only this —
 * registering in the Chirp console and uploading the four files by hand.
 */

export interface PrivilegedRunnerPort {
  /**
   * Writes a file to a location the user cannot normally write.
   *
   * Contract 3 rule 2: on Ubuntu Core this becomes a snap interface rather than
   * pkexec, and no use case may notice.
   */
  writeFile(path: string, content: string, mode?: number): Promise<Result<void>>;
  /** Starts a system service. */
  startService(name: string): Promise<Result<void>>;
}

export interface GatewayPathsPort {
  /** Directory holding tc.uri, tc.trust, tc.crt and tc.key. */
  credentialsDir(): string;
}

export interface GatewayProvisionPorts {
  privileged: PrivilegedRunnerPort;
  paths: GatewayPathsPort;
}

export interface GatewayProvisionProgress {
  /** English text used directly as an i18n key. */
  step: string;
}
