import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from 'date-fns';

import {
  defaultRotationPeriod,
  isRotatingSeries,
  nextDueDate,
  parseDueDate,
} from '@/lib/chores';
import { applyPointEvent } from '@/lib/points';
import { getSupabase } from '@/lib/supabase';
import type { Chore, ChoreSeriesRotation, RotationPeriod } from '@/types';

export { isRotatingSeries } from '@/lib/chores';

export function pickRotatedAssigneeWithLag(
  assigneeIds: string[],
  dueDate: string,
  period: RotationPeriod,
  seriesAnchorDate: string,
  rotationLag: number
): string {
  if (assigneeIds.length === 0) throw new Error('No assignees');
  if (assigneeIds.length === 1) return assigneeIds[0];

  const ordered = [...assigneeIds].sort();
  const anchor = startOfDay(parseDueDate(seriesAnchorDate));
  const due = startOfDay(parseDueDate(dueDate));

  const periodIndex =
    period === 'week'
      ? differenceInCalendarWeeks(due, anchor, { weekStartsOn: 1 })
      : differenceInCalendarDays(due, anchor);

  const idx = (((periodIndex - rotationLag) % ordered.length) + ordered.length) % ordered.length;
  return ordered[idx];
}

function seriesTemplate(chores: Chore[], seriesId: string): Chore | null {
  const inSeries = chores.filter((c) => (c.series_id ?? c.id) === seriesId);
  if (inSeries.length === 0) return null;
  return inSeries.find((c) => !c.completed) ?? inSeries[inSeries.length - 1];
}

function isOccurrenceComplete(chores: Chore[], seriesId: string, dateKey: string): boolean {
  const row = chores.find(
    (c) => (c.series_id ?? c.id) === seriesId && c.due_date === dateKey && !c.id.startsWith('proj-')
  );
  return row?.completed === true;
}

function stepDate(dateKey: string, recurrence: Chore['recurrence_type']): string {
  return nextDueDate(dateKey, recurrence);
}

/** Advance calendar day-by-day from anchor through yesterday; apply misses and lag ripples. */
export async function processRotationCarryOvers(
  groupId: string,
  chores: Chore[],
  rotations: ChoreSeriesRotation[]
): Promise<void> {
  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);

  for (const rot of rotations) {
    const template = seriesTemplate(chores, rot.series_id);
    if (!template || !isRotatingSeries(template)) continue;

    let lag = rot.rotation_lag;
    let cursor = startOfDay(parseDueDate(rot.anchor_date));

    if (rot.last_processed_date) {
      const last = startOfDay(parseDueDate(rot.last_processed_date));
      cursor = addDays(last, 1);
    }

    const period = rot.rotation_period ?? defaultRotationPeriod(template.recurrence_type);

    while (!isAfter(cursor, yesterday)) {
      const dateKey = format(cursor, 'yyyy-MM-dd');
      const assignee = pickRotatedAssigneeWithLag(
        rot.assignee_queue,
        dateKey,
        period,
        rot.anchor_date,
        lag
      );

      const done = isOccurrenceComplete(chores, rot.series_id, dateKey);
      if (!done && isBefore(cursor, today)) {
        await applyPointEvent(
          groupId,
          assignee,
          rot.series_id,
          dateKey,
          -1,
          'missed'
        );
        const { data: newLag } = await getSupabase().rpc('bump_rotation_lag', {
          p_series_id: rot.series_id,
          p_processed_through: dateKey,
        });
        if (typeof newLag === 'number') lag = newLag;
      }

      cursor = parseISO(stepDate(dateKey, template.recurrence_type));
    }

    if (!isAfter(cursor, addDays(yesterday, 1))) {
      await getSupabase().rpc('set_rotation_processed_through', {
        p_series_id: rot.series_id,
        p_processed_through: format(yesterday, 'yyyy-MM-dd'),
      });
    }
  }
}

export async function fetchSeriesRotations(groupId: string): Promise<ChoreSeriesRotation[]> {
  const { data, error } = await getSupabase()
    .from('chore_series_rotation')
    .select('*')
    .eq('group_id', groupId);
  if (error) {
    if (error.code === '42P01' || error.message.includes('chore_series_rotation')) {
      return [];
    }
    throw error;
  }
  return (data ?? []) as ChoreSeriesRotation[];
}

export async function ensureSeriesRotation(
  chore: Chore,
  groupId: string,
  seriesId: string,
  anchorDate: string
): Promise<void> {
  if (!isRotatingSeries(chore)) return;
  const queue = chore.assignee_ids.length > 0 ? chore.assignee_ids : [chore.assigned_to];
  const period = chore.rotation_period ?? defaultRotationPeriod(chore.recurrence_type);
  await getSupabase().rpc('upsert_chore_series_rotation', {
    p_series_id: seriesId,
    p_group_id: groupId,
    p_assignee_queue: queue,
    p_anchor_date: anchorDate,
    p_rotation_period: period,
  });
}

export function rotationLagForSeries(
  rotations: ChoreSeriesRotation[],
  seriesId: string
): number {
  return rotations.find((r) => r.series_id === seriesId)?.rotation_lag ?? 0;
}

/** Ensure rotation rows exist for rotating series created before this migration. */
export async function backfillSeriesRotations(
  groupId: string,
  chores: Chore[]
): Promise<void> {
  const seen = new Set<string>();
  for (const c of chores) {
    if (!isRotatingSeries(c)) continue;
    const sid = c.series_id ?? c.id;
    if (seen.has(sid)) continue;
    seen.add(sid);
    const inSeries = chores.filter((x) => (x.series_id ?? x.id) === sid);
    const anchor = inSeries.reduce(
      (min, x) => (x.due_date < min ? x.due_date : min),
      inSeries[0]?.due_date ?? c.due_date
    );
    const template =
      inSeries.find((x) => !x.completed) ?? inSeries[inSeries.length - 1] ?? c;
    try {
      await ensureSeriesRotation(template, groupId, sid, anchor);
    } catch {
      /* table may not exist yet */
    }
  }
}
