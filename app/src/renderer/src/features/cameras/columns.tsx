import { Button } from '@chirpwireless/ui-kit/primitives';
import type { TableColumnDef } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import type { TFunction } from 'i18next';

import type { CameraPayload } from '@shared/ipc';

import { LAYOUT } from '../../config/defaults';

/**
 * Camera table columns — **data, not markup**.
 *
 * Contract 1 (D): cells render the row they are handed. The handlers arrive as
 * arguments rather than being pulled from a hook, so these render from a plain
 * object with no app running.
 */

export interface CameraColumnActions {
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export const cameraColumns = (t: TFunction, actions: CameraColumnActions): TableColumnDef<CameraPayload>[] => [
  {
    header: t('Name'),
    accessorKey: 'displayName',
    cell: ({ row }) => <Typography variant='body2'>{row.original.displayName}</Typography>,
  },
  {
    header: t('Address'),
    accessorKey: 'address',
    cell: ({ row }) => <Typography variant='body2'>{row.original.address}</Typography>,
  },
  {
    header: t('Status'),
    accessorKey: 'online',
    cell: ({ row }) => (
      // A stopped camera stays in the list, marked — hiding it would make a
      // failure look like the user had deleted it.
      <Typography variant='body2' sx={{ color: row.original.online ? 'success.main' : 'error.main' }}>
        {t(
          row.original.online
            ? row.original.recording === 'motion'
              ? 'Recording motion'
              : 'Recording continuously'
            : 'Offline'
        )}
      </Typography>
    ),
  },
  {
    header: '',
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => (
      <Stack direction='row' sx={{ gap: LAYOUT.themeToggleGap, justifyContent: 'flex-end' }}>
        {/* The camera's own interface has live view, recordings and every
            setting this app deliberately does not expose. Only offered while it
            is running — there is nothing to open otherwise. */}
        {row.original.online ? (
          <Button variant='secondary' size='small' onClick={() => actions.onOpen(row.original.id)}>
            {t('Open camera')}
          </Button>
        ) : null}

        <Button variant='secondary' size='small' onClick={() => actions.onRemove(row.original.id)}>
          {t('Remove')}
        </Button>
      </Stack>
    ),
  },
];
