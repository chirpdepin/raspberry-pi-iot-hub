import { Button, Card } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CameraPayload } from '@shared/ipc';

interface CameraRowProps {
  camera: CameraPayload;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One camera in the list.
 *
 * A stopped camera stays in the list, marked — hiding it would make a failure
 * look like the user had deleted it (Contract 2 rule 2).
 */
export const CameraRow = memo<CameraRowProps>(({ camera, onOpen, onRemove }) => {
  const { t } = useTranslation();

  const handleOpen = () => onOpen(camera.id);
  const handleRemove = () => onRemove(camera.id);

  return (
    <Card>
      <Stack sx={{ gap: '8px', padding: '8px' }}>
        <Stack direction='row' sx={{ justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <Stack sx={{ gap: '2px' }}>
            <Typography variant='body1'>{camera.displayName}</Typography>
            <Typography variant='body2' sx={(theme) => ({ color: theme.palette.text.secondary })}>
              {camera.address}
            </Typography>
          </Stack>

          <Stack direction='row' sx={{ gap: '8px' }}>
            {/* The camera's own interface has live view, recordings and every
                setting this app deliberately does not expose. Only offered while
                it is running — there is nothing to open otherwise. */}
            {camera.online ? (
              <Button variant='secondary' size='small' onClick={handleOpen}>
                {t('Open camera')}
              </Button>
            ) : null}

            <Button variant='secondary' size='small' onClick={handleRemove}>
              {t('Remove')}
            </Button>
          </Stack>
        </Stack>

        <Stack direction='row' sx={{ gap: '16px', flexWrap: 'wrap' }}>
          <Typography
            variant='body2'
            sx={(theme) => ({ color: camera.online ? theme.palette.success.main : theme.palette.error.main })}
          >
            {camera.online
              ? t(camera.recording === 'motion' ? 'Recording motion' : 'Recording continuously')
              : t('Offline')}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
});
