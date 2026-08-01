import { Button } from '@chirpwireless/ui-kit/primitives';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { PlusIcon } from '../../assets/chirp/PlusIcon';
import { LAYOUT } from '../../config/defaults';

interface PageActionProps {
  /** English text used as the i18n key. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Most page actions add something; set false for one that does not. */
  showPlus?: boolean;
}

/**
 * The page header's action button, styled exactly as Chirp's.
 *
 * `variant='secondary'` is Chirp's choice for this position and is worth not
 * "correcting": the page action is not the loudest thing on a screen that also
 * carries content, and a primary-filled button in the corner competes with the
 * action inside an empty state, which genuinely is the next step.
 *
 * Contract 4: one definition, so every page's action looks the same.
 */
export const PageAction = memo<PageActionProps>(({ label, onClick, disabled, showPlus = true }) => {
  const { t } = useTranslation();

  return (
    <Button
      color='primary'
      variant='secondary'
      size='medium'
      type='button'
      title={t(label)}
      disabled={disabled}
      onClick={onClick}
      // minWidth stops a long translation from being squeezed by the title.
      sx={{ gap: LAYOUT.headerGap, minWidth: 'max-content' }}
    >
      {showPlus ? <PlusIcon /> : null}
      {t(label)}
    </Button>
  );
});
