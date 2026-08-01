/**
 * Camera domain.
 *
 * Contract 1: no imports.
 */

export interface DiscoveredCamera {
  /** ONVIF service address, e.g. http://192.168.2.40/onvif/device_service */
  xaddr: string;
  address: string;
  manufacturer: string | null;
  model: string | null;
}

export interface CameraCredentials {
  username: string;
  password: string;
}

export type RecordingMode = 'motion' | 'continuous';

export interface CameraConfig {
  displayName: string;
  address: string;
  credentials: CameraCredentials;
  /** Vendor-prefilled; only surfaced under Advanced. */
  rtspPath: string;
  onvifPort: number;
  recording: RecordingMode;
  retentionDays: number;
}

export interface Camera {
  id: string;
  displayName: string;
  address: string;
  /** Host port the Twin's web UI is mapped to. */
  hostPort: number;
  recording: RecordingMode;
  online: boolean;
}

/**
 * Vendor RTSP path profiles — a **registry**, so a new vendor is one row
 * (Contract 1 O). The user never sees these unless they open Advanced.
 */
export interface SourceProfile {
  /** Case-insensitive substrings matched against manufacturer and model. */
  match: string[];
  /** Main (recording) stream path. */
  mainPath: string;
  /** Sub (preview) stream path, usually lower resolution. */
  subPath: string;
  onvifPort: number;
}

export const SOURCE_PROFILES: readonly SourceProfile[] = [
  {
    match: ['hikvision', 'hilook'],
    mainPath: '/Streaming/Channels/101',
    subPath: '/Streaming/Channels/102',
    onvifPort: 80,
  },
  {
    match: ['dahua', 'amcrest'],
    mainPath: '/cam/realmonitor?channel=1&subtype=0',
    subPath: '/cam/realmonitor?channel=1&subtype=1',
    onvifPort: 80,
  },
  {
    match: ['axis'],
    mainPath: '/axis-media/media.amp',
    subPath: '/axis-media/media.amp?resolution=640x480',
    onvifPort: 80,
  },
  { match: ['reolink'], mainPath: '/h264Preview_01_main', subPath: '/h264Preview_01_sub', onvifPort: 8000 },
  { match: ['tp-link', 'tapo', 'vigi'], mainPath: '/stream1', subPath: '/stream2', onvifPort: 2020 },
  { match: ['ubiquiti', 'unifi'], mainPath: '/s0', subPath: '/s1', onvifPort: 80 },
] as const;

/** ONVIF is the standard; this path works on most cameras that implement it. */
const GENERIC_PROFILE: SourceProfile = {
  match: [],
  mainPath: '/onvif1',
  subPath: '/onvif2',
  onvifPort: 80,
};

export const profileFor = (manufacturer: string | null, model: string | null): SourceProfile => {
  const haystack = `${manufacturer ?? ''} ${model ?? ''}`.toLowerCase();

  for (const profile of SOURCE_PROFILES) {
    if (profile.match.some((needle) => haystack.includes(needle))) return profile;
  }

  return GENERIC_PROFILE;
};

/** Builds the RTSP URL a Twin will use. Credentials are embedded, as RTSP requires. */
export const rtspUrl = (config: CameraConfig): string => {
  const auth = `${encodeURIComponent(config.credentials.username)}:${encodeURIComponent(config.credentials.password)}`;
  return `rtsp://${auth}@${config.address}:554${config.rtspPath}`;
};

/**
 * Maps a probe failure to a cause and a next action.
 *
 * Contract 2 rule 2: `ECONNREFUSED 192.168.2.40:554` tells a non-technical user
 * nothing. Each of these says what is wrong and what to do about it.
 */
export type ProbeFailure = 'unauthorized' | 'unreachable' | 'unsupported-codec' | 'no-stream' | 'unknown';

export const probeFailureMessage = (failure: ProbeFailure, address: string): string => {
  switch (failure) {
    case 'unauthorized':
      return 'Wrong username or password for this camera.';
    case 'unreachable':
      return `Can't reach the camera at ${address}. Check it's powered on and on the same network.`;
    case 'unsupported-codec':
      return "This camera streams in a format we can't record yet. Try the sub-stream.";
    case 'no-stream':
      return 'Found the camera but not a video stream.';
    default:
      return "Couldn't connect to this camera.";
  }
};

/** Classifies a raw probe error into one of the mapped failures. */
export const classifyProbeError = (raw: string): ProbeFailure => {
  const text = raw.toLowerCase();

  if (/401|unauthor|authentication|password/.test(text)) return 'unauthorized';
  if (/econnrefused|ehostunreach|etimedout|timeout|no route/.test(text)) return 'unreachable';
  if (/h265|hevc|codec|unsupported/.test(text)) return 'unsupported-codec';
  if (/404|not found|no stream|no track/.test(text)) return 'no-stream';

  return 'unknown';
};
