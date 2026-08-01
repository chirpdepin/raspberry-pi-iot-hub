import type { TableColumnDef } from '@chirpwireless/ui-kit/primitives';
import { Typography } from '@mui/material';
import type { TFunction } from 'i18next';

import type { ConcentratorInfo } from '@shared/ipc';

/**
 * Gateway table columns — **data, not markup**.
 *
 * Contract 1 (O): a new column is a row here. Contract 1 (D): cells render the
 * row they are handed, so this module renders from a plain object in a test.
 */
export const gatewayColumns = (t: TFunction): TableColumnDef<ConcentratorInfo>[] => [
  {
    header: t('Gateway EUI'),
    accessorKey: 'eui',
    // Read from the concentrator chip, never typed by the user — which is why
    // it can be shown rather than asked for.
    cell: ({ row }) => <Typography variant='body2'>{row.original.eui}</Typography>,
  },
  {
    header: t('Radio'),
    accessorKey: 'model',
    cell: ({ row }) => <Typography variant='body2'>{row.original.model}</Typography>,
  },
  {
    header: t('Connection'),
    accessorKey: 'interface',
    cell: ({ row }) => (
      <Typography variant='body2'>
        {row.original.interface} · {row.original.devicePath}
      </Typography>
    ),
  },
];
