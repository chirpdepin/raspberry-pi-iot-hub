import { Table } from '@chirpwireless/ui-kit/primitives';
import type { TableColumnDef } from '@chirpwireless/ui-kit/primitives';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { LAYOUT } from '../../config/defaults';
import { EmptyState } from './EmptyState';

interface DataTableProps<TData> {
  /** Optional section heading, e.g. "Coordinator" or "Devices". i18n key. */
  heading?: string;
  data: TData[];
  columns: TableColumnDef<TData>[];
  /**
   * Must reach the kit as an explicit `false` for the empty block to render —
   * see below.
   */
  isLoading?: boolean;
  /** Shown inside the table when it has no rows. i18n key. */
  emptyTitle: string;
  /** Optional supporting line under that title. i18n key. */
  emptyDescription?: string;
}

/**
 * The one table used everywhere.
 *
 * Wraps the kit's `Table` and supplies our `EmptyState` as its
 * `renderEmptyBlock` — the idiom Chirp's SIM cards page uses, where **the table
 * is always rendered and owns its empty state**. That is what removes the
 * page-level branch between "empty" and "populated": a screen renders one thing
 * in both cases, and nothing on it moves when the first row arrives.
 *
 * Contract 1 (S): it arranges. It does not fetch, and it does not decide what a
 * row means — columns describe that, and the feature hook decides.
 * Contract 1 (O): a new screen supplies data and a column list; this file is
 * never edited for one.
 */
export const DataTable = <TData,>({
  heading,
  data,
  columns,
  // Defaulted to `false` deliberately. The kit renders its empty block only
  // when `rows.length === 0 && isLoading === false` — a strict comparison, so
  // leaving this `undefined` silently produces a table with a header and
  // nothing beneath it. That is exactly what happened first time round.
  isLoading = false,
  emptyTitle,
  emptyDescription,
}: DataTableProps<TData>) => {
  const { t } = useTranslation();

  return (
    <Stack sx={{ gap: LAYOUT.headerGap, width: '100%' }}>
      {heading ? (
        <Typography variant='body2' sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
          {t(heading)}
        </Typography>
      ) : null}

      <Table<TData>
        data={data}
        columns={columns}
        isLoading={isLoading}
        renderEmptyBlock={() => <EmptyState title={emptyTitle} description={emptyDescription} />}
      />
    </Stack>
  );
};
