import type { TableColumnDef } from '@chirpwireless/ui-kit/primitives';
import { Typography } from '@mui/material';
import type { TFunction } from 'i18next';

import type { ZigbeeCoordinatorInfo, ZigbeeDeviceInfo } from '@shared/ipc';

import { DeviceStatusDots } from './DeviceStatusDots';

/**
 * Zigbee table columns — **data, not markup**.
 *
 * Contract 1 (O): a new column is a row in this file; no table component is
 * edited. Contract 1 (D): a cell renders the row it is handed and never reaches
 * for IPC or a query, which is what lets these render from a plain object in a
 * test with no app running.
 *
 * `t` is passed in rather than hooked, because these are plain functions and a
 * hook would tie them to a React render.
 */

/** Signal strength in words. 255 is the maximum LQI; the bands are the usual ones. */
export const signalLabel = (linkQuality: number | null): string => {
  if (linkQuality === null) return 'Unknown';
  if (linkQuality >= 150) return 'Good';
  if (linkQuality >= 80) return 'Fair';
  return 'Weak';
};

/** Mains devices report no battery at all, which is not the same as empty. */
export const batteryLabel = (batteryPercent: number | null): string =>
  batteryPercent === null ? '—' : `${batteryPercent}%`;

const text = (value: string) => <Typography variant='body2'>{value}</Typography>;

export const coordinatorColumns = (t: TFunction): TableColumnDef<ZigbeeCoordinatorInfo>[] => [
  {
    header: t('Coordinator'),
    accessorKey: 'model',
    cell: ({ row }) => text(row.original.model),
  },
  {
    header: t('Connection'),
    accessorKey: 'port',
    cell: ({ row }) => text(row.original.port),
  },
  {
    header: t('Type'),
    accessorKey: 'adapter',
    // Detection leaves this empty on purpose when the USB descriptor is
    // inconclusive: an empty field prompts a question, a wrong one fails
    // confusingly later.
    cell: ({ row }) => text(row.original.adapter ?? t('Unknown')),
  },
];

export const deviceColumns = (t: TFunction): TableColumnDef<ZigbeeDeviceInfo>[] => [
  {
    header: t('Name'),
    accessorKey: 'displayName',
    cell: ({ row }) => text(row.original.displayName),
  },
  {
    header: t('Type'),
    accessorKey: 'model',
    cell: ({ row }) => {
      const { manufacturer, model, type } = row.original;
      return text([manufacturer, model].filter(Boolean).join(' ') || type);
    },
  },
  {
    header: t('Status'),
    id: 'status',
    enableSorting: false,
    // The two-dot troubleshooting story: is it my device, or the cloud?
    cell: ({ row }) => (
      <DeviceStatusDots
        connectedToHub={row.original.connectedToHub}
        connectedToChirp={row.original.connectedToChirp}
      />
    ),
  },
  {
    header: t('Signal'),
    accessorKey: 'linkQuality',
    cell: ({ row }) => text(t(signalLabel(row.original.linkQuality))),
  },
  {
    header: t('Battery'),
    accessorKey: 'batteryPercent',
    cell: ({ row }) => text(batteryLabel(row.original.batteryPercent)),
  },
];
