import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  isAfter,
  isBefore,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';

import type { Chore, RecurrenceType, RotationMode, RotationPeriod, TradeOffer } from '@/types';

export const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'once', label: 'One time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function recurrenceLabel(type: RecurrenceType): string {
  return RECURRENCE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function defaultRotationPeriod(recurrence: RecurrenceType): RotationPeriod {
  return recurrence === 'daily' ? 'day' : 'week';
}

/** Parse YYYY-MM-DD due dates in local time (avoids UTC off-by-one). */
export function parseDueDate(dueDate: string): Date {
  const trimmed = dueDate.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]) - 1;
    const d = Number(dateOnly[3]);
    return startOfDay(new Date(y, m, d));
  }
  return startOfDay(parseISO(trimmed));
}

/** Rolling 7-day window: today through six days ahead (inclusive). */
export function getRollingWeekBounds(now = new Date()) {
  const today = startOfDay(now);
  return { today, weekEnd: addDays(today, 6) };
}

export type DueBucket = 'overdue' | 'today' | 'thisWeek' | 'later';

export function classifyDueBucket(dueDate: string, now = new Date()): DueBucket {
  const d = parseDueDate(dueDate);
  const { today, weekEnd } = getRollingWeekBounds(now);
  if (isBefore(d, today)) return 'overdue';
  if (isToday(d)) return 'today';
  if (isAfter(d, weekEnd)) return 'later';
  return 'thisWeek';
}

export function isDueInRollingWeek(dueDate: string, now = new Date()): boolean {
  const d = parseDueDate(dueDate);
  const { today, weekEnd } = getRollingWeekBounds(now);
  if (isBefore(d, today)) return false;
  return !isAfter(d, weekEnd);
}

/** First calendar day the chore may be marked complete (day before due). */
export function earliestCompleteDate(dueDate: string): Date {
  return startOfDay(addDays(parseDueDate(dueDate), -1));
}

export function daysUntilDue(dueDate: string, now = new Date()): number {
  return differenceInCalendarDays(parseDueDate(dueDate), startOfDay(now));
}

export function canMarkChoreComplete(
  chore: { completed: boolean; due_date: string },
  now = new Date()
): boolean {
  if (chore.completed) return true;
  return daysUntilDue(chore.due_date, now) <= 1;
}

export function choreCompleteLockedMessage(dueDate: string, now = new Date()): string {
  const earliest = earliestCompleteDate(dueDate);
  const today = startOfDay(now);
  if (!isBefore(today, earliest)) return '';

  if (isToday(earliest)) {
    return 'You can mark this done starting today.';
  }
  return `You can mark this done starting ${format(earliest, 'EEEE, MMM d')}.`;
}

export function nextDueDate(dueDate: string, recurrence: RecurrenceType): string {
  const d = parseISO(dueDate);
  if (recurrence === 'daily') return format(addDays(d, 1), 'yyyy-MM-dd');
  if (recurrence === 'weekly') return format(addWeeks(d, 1), 'yyyy-MM-dd');
  if (recurrence === 'monthly') return format(addMonths(d, 1), 'yyyy-MM-dd');
  return dueDate;
}

/**
 * Fair round-robin: cycles A → B → C → A so the same person is never
 * assigned on back-to-back days (or weeks) unless there is only one assignee.
 */
export function pickRotatedAssignee(
  assigneeIds: string[],
  dueDate: string,
  period: RotationPeriod,
  seriesAnchorDate: string,
  rotationLag = 0
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

  const shifted = periodIndex - rotationLag;
  const idx = ((shifted % ordered.length) + ordered.length) % ordered.length;
  return ordered[idx];
}

export function resolvePrimaryAssignee(
  assigneeIds: string[],
  dueDate: string,
  recurrence: RecurrenceType,
  rotationMode: RotationMode,
  rotationPeriod: RotationPeriod | null,
  seriesAnchorDate: string,
  rotationLag = 0
): string {
  if (assigneeIds.length === 0) throw new Error('Pick at least one person');
  if (assigneeIds.length === 1) return assigneeIds[0];

  if (recurrence !== 'once' && rotationMode === 'random') {
    const period = rotationPeriod ?? defaultRotationPeriod(recurrence);
    return pickRotatedAssignee(assigneeIds, dueDate, period, seriesAnchorDate, rotationLag);
  }

  return assigneeIds[0];
}

export function choreAppliesToUser(chore: Chore, userId: string): boolean {
  if (chore.recurrence_type !== 'once' && chore.rotation_mode === 'random') {
    return chore.assigned_to === userId;
  }
  const ids = chore.assignee_ids?.length > 0 ? chore.assignee_ids : [chore.assigned_to];
  return ids.includes(userId);
}

export function isRotatingSeries(chore: Chore): boolean {
  return (
    chore.recurrence_type !== 'once' &&
    chore.rotation_mode === 'random' &&
    (chore.assignee_ids?.length ?? 0) > 1
  );
}

export function normalizeTradeOffer(row: Record<string, unknown>): TradeOffer {
  const legacyOffered = row.offered_chore_id as string | undefined;
  const legacyRequested = row.requested_chore_id as string | undefined;
  const offered =
    (row.offered_chore_ids as string[] | undefined)?.filter(Boolean) ??
    (legacyOffered ? [legacyOffered] : []);
  const requested =
    (row.requested_chore_ids as string[] | undefined)?.filter(Boolean) ??
    (legacyRequested ? [legacyRequested] : []);

  return {
    id: row.id as string,
    group_id: row.group_id as string,
    from_user_id: row.from_user_id as string,
    to_user_id: row.to_user_id as string,
    offered_chore_ids: offered,
    requested_chore_ids: requested,
    status: row.status as TradeOffer['status'],
    created_at: row.created_at as string,
  };
}

export function choreTitlesByIds(
  choreIds: string[],
  chores: Chore[],
  fallback = 'Unknown chore'
): string {
  const titles = choreIds
    .map((id) => chores.find((c) => c.id === id)?.title ?? fallback)
    .filter((t) => t !== fallback || choreIds.length === 1);
  return titles.length > 0 ? titles.join(', ') : fallback;
}

export function buildChoreReassignUpdate(
  chore: Chore,
  newUserId: string
): { assigned_to: string; assignee_ids?: string[] } {
  const payload: { assigned_to: string; assignee_ids?: string[] } = {
    assigned_to: newUserId,
  };
  if (chore.assignee_ids && chore.assignee_ids.length > 0) {
    const prev = chore.assigned_to;
    const next = chore.assignee_ids.map((id) => (id === prev ? newUserId : id));
    payload.assignee_ids = next.includes(newUserId) ? next : [newUserId];
  }
  return payload;
}

export function formatChoreDbError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? '';
  const code = error.code ?? '';

  if (
    msg.includes('offered_chore_ids') ||
    msg.includes('requested_chore_ids') ||
    (msg.includes('offered_chore_id') && msg.includes('column'))
  ) {
    return 'Database is missing multi-chore trade columns. In Supabase SQL Editor, run supabase/trades-multi-migration.sql then reload the app.';
  }

  if (
    code === 'PGRST204' ||
    msg.includes('assignee_ids') ||
    msg.includes('recurrence_type') ||
    msg.includes('rotation_mode') ||
    msg.includes('series_id') ||
    msg.includes('schema cache')
  ) {
    return 'Database is missing chore columns. In Supabase SQL Editor, run supabase/chores-recurrence-migration.sql then reload the app.';
  }

  if (msg.includes('foreign key') && msg.includes('series_id')) {
    return 'Database constraint issue on recurring chores. Run supabase/chores-recurrence-fix.sql in Supabase SQL Editor.';
  }

  if (msg.includes('violates check constraint')) {
    return 'Invalid chore options. Try again or pick different schedule settings.';
  }

  return msg || 'Could not add chore';
}

export function normalizeChore(row: Chore & Partial<Chore>): Chore {
  const assigneeIds =
    row.assignee_ids && row.assignee_ids.length > 0 ? row.assignee_ids : [row.assigned_to];

  return {
    ...row,
    assignee_ids: assigneeIds,
    recurrence_type: row.recurrence_type ?? 'once',
    rotation_mode: row.rotation_mode ?? 'none',
    rotation_period: row.rotation_period ?? null,
    series_id: row.series_id ?? null,
  };
}

export function formatAssigneeSummary(
  chore: Chore,
  getMember: (id: string) => { username: string } | undefined
): string {
  const ids =
    chore.assignee_ids?.length > 0 ? chore.assignee_ids : [chore.assigned_to];

  if (chore.recurrence_type !== 'once' && chore.rotation_mode === 'random' && ids.length > 1) {
    const current = getMember(chore.assigned_to)?.username ?? '…';
    const pool = ids.length;
    return `@${current} · rotates (${pool})`;
  }

  if (ids.length > 1) {
    const names = ids
      .map((id) => getMember(id)?.username)
      .filter(Boolean)
      .map((u) => `@${u}`);
    return names.join(', ');
  }

  const one = getMember(chore.assigned_to)?.username;
  return one ? `@${one}` : '';
}

export function isProjectedChoreId(id: string): boolean {
  return id.startsWith('proj-');
}

function projectChoreForDate(
  template: Chore,
  dateKey: string,
  seriesAnchorDate: string,
  rotationLag = 0
): Chore {
  const seriesId = template.series_id ?? template.id;
  let assignedTo = template.assigned_to;

  if (
    template.rotation_mode === 'random' &&
    template.assignee_ids.length > 1 &&
    template.recurrence_type !== 'once'
  ) {
    const period = template.rotation_period ?? defaultRotationPeriod(template.recurrence_type);
    assignedTo = pickRotatedAssignee(
      template.assignee_ids,
      dateKey,
      period,
      seriesAnchorDate,
      rotationLag
    );
  }

  return {
    ...template,
    id: `proj-${seriesId}-${dateKey}`,
    due_date: dateKey,
    assigned_to: assignedTo,
    completed: false,
    completed_at: null,
  };
}

/** Map calendar days → chores, including projected recurring occurrences. */
export function expandChoresForCalendar(
  chores: Chore[],
  rangeStart: Date,
  rangeEnd: Date,
  rotationLagBySeries: Record<string, number> = {}
): Map<string, Chore[]> {
  const byDate = new Map<string, Chore[]>();
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);

  const add = (dateKey: string, chore: Chore) => {
    if (!isWithinInterval(parseISO(dateKey), { start, end })) return;
    const list = byDate.get(dateKey) ?? [];
    const dup = list.some(
      (c) =>
        c.id === chore.id ||
        (c.series_id &&
          chore.series_id &&
          c.series_id === chore.series_id &&
          c.due_date === chore.due_date)
    );
    if (!dup) list.push(chore);
    byDate.set(dateKey, list);
  };

  for (const chore of chores) {
    if (chore.recurrence_type === 'once') {
      add(chore.due_date, chore);
    }
  }

  const seriesIds = new Set<string>();
  for (const c of chores) {
    if (c.recurrence_type !== 'once') {
      seriesIds.add(c.series_id ?? c.id);
    }
  }

  for (const sid of seriesIds) {
    const inSeries = chores.filter((c) => (c.series_id ?? c.id) === sid);
    if (inSeries.length === 0) continue;

    const template =
      inSeries.find((c) => !c.completed) ?? inSeries[inSeries.length - 1];
    const anchor = inSeries.reduce(
      (min, c) => (c.due_date < min ? c.due_date : min),
      inSeries[0].due_date
    );
    const lag = rotationLagBySeries[sid] ?? 0;

    let cursor = parseISO(anchor);
    while (cursor < start) {
      cursor = parseISO(
        nextDueDate(format(cursor, 'yyyy-MM-dd'), template.recurrence_type)
      );
    }

    while (cursor <= end) {
      const key = format(cursor, 'yyyy-MM-dd');
      const actual = inSeries.find((c) => c.due_date === key);
      const projected = projectChoreForDate(template, key, anchor, lag);
      add(
        key,
        actual && template.rotation_mode === 'random' && template.assignee_ids.length > 1
          ? { ...actual, assigned_to: projected.assigned_to }
          : (actual ?? projected)
      );
      cursor = parseISO(nextDueDate(key, template.recurrence_type));
    }
  }

  return byDate;
}

/** DB rows plus projected recurring occurrences (respects carry-over lag). */
export function mergeChoresWithProjections(
  chores: Chore[],
  rotationLagBySeries: Record<string, number>,
  pastDays = 14,
  futureDays = 45
): Chore[] {
  const today = startOfDay(new Date());
  const rangeStart = addDays(today, -pastDays);
  const rangeEnd = addDays(today, futureDays);
  const byDate = expandChoresForCalendar(chores, rangeStart, rangeEnd, rotationLagBySeries);

  const byKey = new Map<string, Chore>();
  for (const c of chores) {
    byKey.set(`${c.series_id ?? c.id}:${c.due_date}`, c);
  }

  for (const list of byDate.values()) {
    for (const c of list) {
      const key = `${c.series_id ?? c.id}:${c.due_date}`;
      const existing = byKey.get(key);
      if (!existing || isProjectedChoreId(existing.id)) {
        byKey.set(key, c);
        continue;
      }
      if (
        c.recurrence_type !== 'once' &&
        c.rotation_mode === 'random' &&
        c.assignee_ids.length > 1
      ) {
        byKey.set(key, { ...existing, assigned_to: c.assigned_to });
      }
    }
  }

  return [...byKey.values()];
}

export function resolveChoreForToggle(
  chore: Chore,
  allChores: Chore[]
): Chore | undefined {
  if (!isProjectedChoreId(chore.id)) {
    return allChores.find((c) => c.id === chore.id);
  }
  if (!chore.series_id) return undefined;
  return allChores.find(
    (c) =>
      !isProjectedChoreId(c.id) &&
      c.series_id === chore.series_id &&
      c.due_date === chore.due_date
  );
}
