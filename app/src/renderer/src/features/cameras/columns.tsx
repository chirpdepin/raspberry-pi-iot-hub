import { Button } from '@chirpwireless/ui-kit/primitives';
import type { TableColumnDef } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import type { TFunction } from 'i18next';

import type { CameraPayload, DiscoveredCameraPayload } from '@shared/ipc';

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
  /**
   * Takes the whole camera, not an id: removing asks a question that names the
   * camera, and a confirmation that says "this one" instead of its name is how
   * people delete the wrong thing.
   */
  onRemove: (camera: CameraPayload) => void;
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
        {t(row.original.online ? 'Running' : 'Offline')}
      </Typography>
    ),
  },
  {
    header: '',
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => (
      <Stack direction='row' sx={{ gap: LAYOUT.themeToggleGap, justifyContent: 'flex-end' }}>
        {/* The camera's own interface is where everything about it is set:
            live view, recordings, the stream, the Chirp connection. Only
            offered while it is running — there is nothing to open otherwise. */}
        {row.original.online ? (
          <Button variant='secondary' size='small' onClick={() => actions.onOpen(row.original.id)}>
            {t('Open camera')}
          </Button>
        ) : null}

        <Button variant='secondary' size='small' onClick={() => actions.onRemove(row.original)}>
          {t('Remove')}
        </Button>
      </Stack>
    ),
  },
];

export interface DiscoveredColumnActions {
  onSetUp: (camera: DiscoveredCameraPayload) => void;
  /** The address currently being set up, so its row can say so. */
  busyAddress: string | null;
}

/**
 * The scan results.
 *
 * One action per row and it is the same action every time: set the camera up
 * and open it. A camera that already has one opens instead — the user does not
 * have to know which of the two happened, only that clicking their camera gets
 * them to it.
 */
export const discoveredColumns = (
  t: TFunction,
  actions: DiscoveredColumnActions
): TableColumnDef<DiscoveredCameraPayload>[] => [
  {
    header: t('Camera'),
    accessorKey: 'label',
    cell: ({ row }) => <Typography variant='body2'>{row.original.label}</Typography>,
  },
  {
    header: t('Address'),
    accessorKey: 'address',
    cell: ({ row }) => <Typography variant='body2'>{row.original.address}</Typography>,
  },
  {
    header: '',
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => (
      <Stack direction='row' sx={{ gap: LAYOUT.themeToggleGap, justifyContent: 'flex-end' }}>
        <Button
          variant={row.original.alreadyAdded ? 'secondary' : 'primary'}
          size='small'
          disabled={actions.busyAddress !== null}
          onClick={() => actions.onSetUp(row.original)}
        >
          {t(
            actions.busyAddress === row.original.address
              ? 'Setting up…'
              : row.original.alreadyAdded
                ? 'Open camera'
                : 'Set up'
          )}
        </Button>
      </Stack>
    ),
  },
];
