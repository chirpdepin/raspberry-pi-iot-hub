import type { SubsystemStatusPayload } from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const statusApi = {
  subsystems: (): Promise<SubsystemStatusPayload[]> => window.chirpHub.getSubsystemStatus(),
};
