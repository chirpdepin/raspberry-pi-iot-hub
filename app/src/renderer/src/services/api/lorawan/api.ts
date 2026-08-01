import type { ConcentratorInfo, GatewayRegisterInput, IpcResult, LnsCredentialsPayload } from '@shared/ipc';

/** Transport layer — plain functions, no React (Contract 5). */
export const lorawanApi = {
  detect: (): Promise<ConcentratorInfo | null> => window.chirpHub.detectGateway(),
  register: (input: GatewayRegisterInput): Promise<IpcResult<LnsCredentialsPayload>> =>
    window.chirpHub.registerGateway(input),
  provision: (credentials: LnsCredentialsPayload): Promise<IpcResult<void>> =>
    window.chirpHub.provisionGateway(credentials),
};
