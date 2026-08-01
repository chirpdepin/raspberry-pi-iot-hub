/**
 * LoRaWAN regions available in the picker.
 *
 * Mirrors the enum in the main process domain. Duplicated across the process
 * boundary because `shared/` carries only types the IPC payloads need, and the
 * renderer must not import from `main/`.
 *
 * NOTE: `POST /nodes/nonminer/{band}/{gatewayId}` does not enumerate accepted
 * bands anywhere in the BFF. This list comes from `device_provision_lorawan`
 * plus the LNS hostname pattern and needs one confirmation from the backend
 * team — a wrong value fails at gateway creation.
 */
export const LORAWAN_REGIONS = [
  'EU868',
  'US915',
  'AU915',
  'AS923',
  'AS923-2',
  'EU433',
  'IN865',
  'KR920',
  'RU864',
  'CN470',
  'CN779',
  'ISM2400',
] as const;

/**
 * Region guessed from the system locale, so the user confirms rather than
 * chooses from twelve options they may not understand (Contract 2 rule 3).
 * This is the ONLY place in the product where a region is selected — the device
 * itself is region-agnostic and takes its channel plan from the LNS.
 */
const REGION_BY_COUNTRY: Record<string, string> = {
  US: 'US915',
  CA: 'US915',
  MX: 'US915',
  BR: 'AU915',
  AU: 'AU915',
  NZ: 'AU915',
  IN: 'IN865',
  KR: 'KR920',
  RU: 'RU864',
  CN: 'CN470',
  JP: 'AS923',
  SG: 'AS923',
  TH: 'AS923',
};

export const defaultRegionForLocale = (): string => {
  const locale = typeof navigator === 'undefined' ? 'en-GB' : navigator.language;
  const country = locale.split('-')[1]?.toUpperCase() ?? '';

  // EU868 covers Europe and much of the rest of the world, so it is the
  // least-wrong default when the locale says nothing useful.
  return REGION_BY_COUNTRY[country] ?? 'EU868';
};
