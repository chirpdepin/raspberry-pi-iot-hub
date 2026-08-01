import { EmptyBlock } from '@chirpwireless/ui-kit/primitives';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { ChirpMark } from '../../assets/chirp/ChirpMark';
import { LAYOUT } from '../../config/defaults';

interface EmptyStateProps {
  /** English text used as the i18n key. */
  title: string;
  /** Optional English text used as the i18n key. */
  description?: string;
}

/**
 * The one empty state used everywhere, matching
 * `chirp-frontend/src/features/Devices/DevicesEmptyBlock`.
 *
 * **The title goes through `EmptyBlock`'s `title` prop rather than a
 * `Typography` of our own.** That is the whole reason these screens looked
 * wrong: the kit renders `title` at 12px uppercase, and hand-rolling it as an
 * `h6` produced a heading three times the size with no icon above it. The kit
 * owns this typography — the only way to match Chirp is to let it.
 *
 * **It carries no buttons.** Actions live in the page header and stay there in
 * every state, so nothing moves when the first item arrives. That also closed a
 * real defect: this component rendered a secondary button only when given both
 * a label *and* a handler, and two screens passed only the label — so their
 * empty states offered no next step at all.
 *
 * Contract 2 rule 4 still holds: it says what is missing, and the action for it
 * is visible in the header above.
 */
export const EmptyState = memo<EmptyStateProps>(({ title, description }) => {
  const { t } = useTranslation();

  return (
    <EmptyBlock
      title={t(title)}
      // `neutral.primary` rather than the kit's default `neutral.grey4`:
      // Chirp's choice, and the default is too faint for the one sentence on an
      // otherwise empty screen.
      textColor='neutral.primary'
      icon={<ChirpMark width={LAYOUT.emptyIconSize} height={LAYOUT.emptyIconSize} />}
      sx={{ marginTop: { xs: LAYOUT.emptyTopMarginMobile, lg: 0 }, minHeight: LAYOUT.emptyMinHeight }}
    >
      {description ? t(description) : null}
    </EmptyBlock>
  );
});
