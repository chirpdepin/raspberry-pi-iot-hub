import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';

/**
 * Shared scaffold for the six sections until each grows its real content in
 * Phases 4–8.
 *
 * Contract 2 rule 1: the heading and subtitle are plain English describing what
 * the section is *for*, not what it is made of. Contract 4: both are translation
 * keys, never literals.
 */
export const PagePlaceholder = ({ section }: { section: string }) => {
    const { t } = useTranslation();

    return (
        <Stack spacing={2}>
            <Typography variant="h4">{t(`pages.${section}.title`)}</Typography>
            <Typography variant="body1" sx={(theme) => ({ color: theme.palette.text.secondary })}>
                {t(`pages.${section}.subtitle`)}
            </Typography>
            <Typography variant="body2" sx={(theme) => ({ color: theme.palette.text.disabled })}>
                {t('placeholder.underConstruction')}
            </Typography>
        </Stack>
    );
};
