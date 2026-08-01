import type { Result } from '../../domain/errors';

/**
 * Opens a camera's own web interface.
 *
 * Contract 1 (I): `ExternalOpenPort` is its own narrow port rather than a method
 * added to `ContainerRuntimePort`. Opening a browser has nothing to do with
 * running containers, and a runtime that also opens windows is the beginning of
 * the `SystemPort` god interface the contracts exist to prevent.
 */
export interface ExternalOpenPort {
  open(url: string): Promise<Result<void>>;
}

/**
 * Where a camera is reachable.
 *
 * The port is looked up rather than passed in from the renderer: a URL supplied
 * by the caller is a URL the caller could get wrong, and this one is only ever
 * loopback on a port the app itself allocated.
 */
export interface CameraLocationPort {
  hostPort(id: string): Promise<number | null>;
}

export interface CameraOpenPorts {
  external: ExternalOpenPort;
  location: CameraLocationPort;
}
