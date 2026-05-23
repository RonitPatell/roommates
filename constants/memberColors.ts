/** Distinct accent colors users can pick (one per person in a group, max 10). */
export const MEMBER_COLOR_PALETTE = [
  '#F87171',
  '#FB923C',
  '#FBBF24',
  '#A3E635',
  '#34D399',
  '#22D3EE',
  '#60A5FA',
  '#A78BFA',
  '#F472B6',
  '#E879F9',
] as const;

export type MemberColor = (typeof MEMBER_COLOR_PALETTE)[number];

export function isMemberColor(value: string): value is MemberColor {
  return (MEMBER_COLOR_PALETTE as readonly string[]).includes(value);
}

export function firstAvailableColor(taken: string[]): string | null {
  return MEMBER_COLOR_PALETTE.find((c) => !taken.includes(c)) ?? null;
}
