import { Button, Tooltip } from '@chirpwireless/ui-kit/primitives';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { PlusIcon } from '../../assets/chirp/PlusIcon';
import { LAYOUT } from '../../config/defaults';

interface PageActionProps {
  /** English text used as the i18n key. */
  label: string;
  onClick: () => void;
  /**
   * Chirp pairs a primary action with secondary ones beside it — Alarm's
   * "Add alarm rule" is primary, "Notification Severity" secondary.
   */
  variant?: 'primary' | 'secondary';
  /** Most actions add something; set false for one that does not. */
  showPlus?: boolean;
  /**
   * Why this action cannot be used yet — English text used as the i18n key.
   *
   * Supplying it disables the button and explains itself on hover. The action
   * is **never removed**: hiding it changes the shape of the header, and a
   * control that vanishes is harder to understand than one that says why it is
   * unavailable (Contract 2 rule 2).
   */
  disabledReason?: string;
}

/**
 * A page header action, styled as Chirp's.
 *
 * Contract 4: one definition, so every screen's actions look the same and a
 * change to that styling is a change in one place.
 */
export const PageAction = memo<PageActionProps>(
  ({ label, onClick, variant = 'primary', showPlus = true, disabledReason }) => {
    const { t } = useTranslation();

    const button = (
      <Button
        color='primary'
        variant={variant}
        size='medium'
        type='button'
        disabled={Boolean(disabledReason)}
        onClick={onClick}
        // minWidth stops a long translation being squeezed by the title.
        sx={{ gap: LAYOUT.headerGap, minWidth: 'max-content' }}
      >
        {showPlus ? <PlusIcon /> : null}
        {t(label)}
      </Button>
    );

    if (!disabledReason) return button;

    // A disabled button swallows pointer events, so the tooltip needs a wrapper
    // that still receives them — otherwise the explanation never appears.
    return (
      <Tooltip title={t(disabledReason)}>
        <span>{button}</span>
      </Tooltip>
    );
  }
);
