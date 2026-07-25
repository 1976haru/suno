/**
 * TASK v3.42 Part B1 — real measurement: a 15-song pack's money-chord
 * boilerplate reinforcement text ("hook lands on the downbeat, clear
 * on-beat chord changes, bass on the root, strong chorus lift") was
 * identical across every song, and the pack contained zero uses of any
 * actual arrangement-contrast word (key change, drop, build, breakdown,
 * stop-time, half-time, ...). A killing point comes from arrangement
 * contrast, not chord notation — this pool is the fix: a rotating,
 * per-song "moment" device Suno actually reacts to as production language.
 * Wired the same way core/moneyChordPlan.ts's progression rotation already
 * is (see core/batchPreallocation.ts's hookDeviceText) — seed-assigned per
 * song, never the same device twice in a row, verbatim-enforced in the
 * bridge/API instructions.
 */
export interface HookDevice {
  id: string;
  label: string;
  prompt: string;
}

export const hookDevices: HookDevice[] = [
  {
    id: 'prechorus-dropout',
    label: '후렴 직전 정적',
    prompt: 'drums and bass drop out for the last two bars before the chorus, then the whole band hits together on the chorus downbeat'
  },
  {
    id: 'stop-time',
    label: '스톱타임 강조',
    prompt: 'stop-time accent on the first word of the chorus, band silent for one beat, then groove resumes'
  },
  {
    id: 'octave-lift',
    label: '마지막 후렴 옥타브 상승',
    prompt: 'final chorus vocal jumps up an octave, brighter and more open than the earlier choruses'
  },
  {
    id: 'key-lift',
    label: '마지막 후렴 조 올림',
    prompt: 'final chorus modulates up a semitone for a lift'
  },
  {
    id: 'answer-riff',
    label: '훅 응답 리프',
    prompt: 'a short instrumental riff answers the vocal hook after each chorus line, call and response'
  },
  {
    id: 'double-hook',
    label: '훅 더블링 화음',
    prompt: 'hook line double-tracked with a harmony a third above, wider on every repeat'
  },
  {
    id: 'half-time-chorus',
    label: '하프타임 후렴',
    prompt: 'chorus shifts into a half-time feel for weight, verses stay in normal time'
  },
  {
    id: 'build-fill',
    label: '빌드업 필',
    prompt: 'one-bar drum fill and rising swell leading into the chorus'
  },
  {
    id: 'bridge-breakdown',
    label: '브리지 브레이크다운',
    prompt: 'bridge strips down to voice and a single instrument, then the full arrangement returns for the final chorus'
  },
  {
    id: 'acappella-tag',
    label: '아카펠라 태그',
    prompt: 'final repeat of the hook sung almost a cappella as the outro tag'
  }
];

export function getHookDeviceById(id: string): HookDevice | undefined {
  return hookDevices.find(device => device.id === id);
}
