/**
 * What the line card prints for connection. The switch is the only source of
 * 「已停用」; a report that has not arrived yet is unknown, not off.
 */
export function lineCardStatus<S>(enabled: boolean, state: S | undefined):
  | { kind: 'off' }
  | { kind: 'unknown' }
  | { kind: 'state'; state: S } {
  if (!enabled) return { kind: 'off' }
  if (state === undefined) return { kind: 'unknown' }
  return { kind: 'state', state }
}
