import type { Camera } from '../../domain/camera';

/**
 * Configured cameras, each with its live recording state.
 *
 * Contract 1 (I, S): two narrow ports, because they answer different questions
 * from different places. What the user configured is ours and persists across
 * reboots; whether it is running belongs to the container runtime and is true
 * only right now. Merging them into one port would mean a runtime hiccup could
 * lose a camera's name.
 */

export interface CameraRecordsPort {
  all(): Promise<Camera[]>;
  count(): Promise<number>;
  save(camera: Camera): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TwinStatePort {
  /** Container ids that are running right now. */
  running(): Promise<string[]>;
}

export interface CameraListPorts {
  records: CameraRecordsPort;
  state: TwinStatePort;
}
