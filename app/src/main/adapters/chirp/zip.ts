import { unzipSync } from 'node:zlib';

/**
 * Minimal ZIP reader for the certificate bundle.
 *
 * The BFF returns a small, uncompressed-or-deflated archive with exactly three
 * entries. Pulling in a full ZIP library for that would be a dependency for one
 * well-understood format, so the central-directory walk is done here.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

const STORED = 0;
const DEFLATED = 8;

export const readZipEntries = async (data: ArrayBuffer): Promise<Record<string, string>> => {
  const buffer = Buffer.from(data);
  const entries: Record<string, string> = {};

  // Locate the end-of-central-directory record by scanning backwards.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('not a zip archive');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    // The local header repeats the name and extra fields with its own lengths.
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);

    if (method === STORED) {
      entries[name] = raw.toString('utf8');
    } else if (method === DEFLATED) {
      entries[name] = unzipSync(raw, { finishFlush: 2 }).toString('utf8');
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
};
