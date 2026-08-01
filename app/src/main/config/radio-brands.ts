/**
 * Brands whose USB descriptors identify a coordinator well enough to claim a
 * role automatically.
 *
 * Mirrors `is_known_brand` in `scripts/detect-radios.sh`. The two lists must
 * agree: the script assigns roles on the device and this does it everywhere
 * else, and a device recognised by one but not the other would be claimed on a
 * Pi and ignored on a laptop.
 *
 * **Deliberately separate from `ADAPTER_RULES`.** That answers "which driver",
 * this answers "is this definitely a Zigbee coordinator". A CP2102 bridge
 * (`10c4:ea60`) appears on thousands of unrelated boards, so matching the
 * bridge chip is not enough to auto-claim a radio — a brand string is. Anything
 * unrecognised is still shown to the user, just never auto-assigned.
 *
 * Contract 1 (O): a new brand is one row.
 */
export const KNOWN_BRANDS: readonly string[] = [
  'sonoff',
  'itead',
  'zbdongle',
  'smlight',
  'slzb',
  'conbee',
  'dresden',
  'skyconnect',
  'nabu',
  'zbt-1',
  'zigstar',
  'zig-star',
] as const;

/** Case-insensitive match against the combined vendor and model strings. */
export const isKnownBrand = (vendorAndModel: string): boolean => {
  const haystack = vendorAndModel.toLowerCase();
  return KNOWN_BRANDS.some((brand) => haystack.includes(brand));
};
