import type { Result } from '../../domain/errors';

/**
 * Ports for getting Docker onto this machine.
 *
 * Contract 1 (I) — **this port is declared here, by its consumer**, and is
 * deliberately not `gateway-provision`'s `PrivilegedRunnerPort`. That one exists
 * to write credential files and start a systemd unit; reusing it would turn a
 * narrow, auditable capability into a general "run anything as root", which is
 * exactly the interface nobody can safely review.
 */

export interface DockerInstallPort {
  /**
   * Opens the vendor's installer and returns once it has been handed over.
   *
   * Guided on macOS and Windows on purpose: Docker Desktop needs a paid
   * subscription above 250 employees or $10M revenue, so the user must see and
   * accept Docker's own terms. Installing it silently could put a business user
   * in breach without their knowledge.
   */
  openInstaller(): Promise<Result<void>>;

  /**
   * Installs Docker Engine without the user leaving the app.
   *
   * Only offered where we can identify the distribution, because "linux" spans
   * dozens of package managers and a wrong guess runs a privileged command that
   * does something unintended. Docker Engine is Apache-2.0, so unlike Docker
   * Desktop there is no licensing question here.
   *
   * **This grants the user membership of the `docker` group, which is
   * root-equivalent on the host** — anyone in it can mount the filesystem into a
   * container as root. That is the standard way to use Docker without sudo, and
   * it is a real privilege grant that belongs in the consent text, not in a
   * footnote.
   */
  installEngine(): Promise<Result<void>>;

  /** Whether `installEngine` is possible here, so the UI offers one path or the other. */
  canInstallAutomatically(): Promise<boolean>;
}

export interface DockerInstallPorts {
  installer: DockerInstallPort;
}
