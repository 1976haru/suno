import { describe, expect, it } from 'vitest';
import { evaluateObjectState, type ObjectStateKind } from '../src/core/narrativeState';
import { OBJECT_STATE_POLICY, objectStatePolicyForWorkspace } from '../src/data/objectStatePolicy';
import type { WorkspaceId } from '../src/types';
import pack from './fixtures/distinctChoice20260808Pack.json';

/**
 * 지시문 17 (TASK B, 필수 검증) — ObjectState 엔진. §1-2가 지목한 T10
 * "Before I Lose My Nerve"(편지가 이미 발송된 뒤 다시 읽는 모순)를 실제
 * 20260808 팩에서 재현하고, 회상 표지·복사본 서술이 있으면 억제되는지,
 * 그리고 "구조는 7개 워크스페이스 공통, 차단 권한은 실측된 곳(letter
 * 하나)에만"이 실제로 지켜지는지 확인한다.
 */

interface RawPackSong {
  trackNo: number;
  lyrics: string;
}

const REAL_SONGS = (pack as { songs: RawPackSong[] }).songs;
const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-idol-male', 'kr-idol-female', 'kr-kids', 'jp-kids', 'en-chillhop'];

describe('[지시문 17 TASK B, 인수 기준] 실제 20260808 팩 — T10 편지 상태 모순 검출', () => {
  it('T10 "Before I Lose My Nerve"이 letter kind blocking으로 검출된다', () => {
    const t10 = REAL_SONGS.find(s => s.trackNo === 10)!;
    const policy = objectStatePolicyForWorkspace('senior-oldpop');
    const findings = evaluateObjectState(t10.lyrics, policy.kinds, policy.verifiedKinds, 'english');
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('letter');
    expect(findings[0].severity).toBe('blocking');
    expect(findings[0].lines.join(' ')).toContain('the letter fell');
    expect(findings[0].lines.join(' ')).toContain('read the closing line again');
  });

  it('실제 팩 18곡 전체에서 senior-oldpop 정책(letter/window/light/door/vehicle)으로 이 엔진이 낸 finding은 T10 하나뿐이다(과탐 없음)', () => {
    const policy = objectStatePolicyForWorkspace('senior-oldpop');
    const flaggedTracks = REAL_SONGS
      .map(song => ({ trackNo: song.trackNo, findings: evaluateObjectState(song.lyrics, policy.kinds, policy.verifiedKinds, 'english') }))
      .filter(entry => entry.findings.length > 0);
    expect(flaggedTracks.map(entry => entry.trackNo)).toEqual([10]);
  });
});

describe('[지시문 17 TASK B-2] 회상 표지·복사본 서술이 모순을 억제한다', () => {
  it('회상 표지가 있으면 blocking이 아니라 advisory로 낮아진다', () => {
    const lyrics = '[verse 1]\nI remember when the letter fell\n[chorus]\nI read the closing line again and smiled';
    const findings = evaluateObjectState(lyrics, ['letter'], ['letter'], 'english');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('advisory');
  });

  it('복사본 서술이 인접하면 모순 자체가 사라진다(finding 없음)', () => {
    const lyrics = '[verse 1]\nThe letter fell into the mailbox slot\n[chorus]\nI read the copy again and smiled';
    const findings = evaluateObjectState(lyrics, ['letter'], ['letter'], 'english');
    expect(findings).toEqual([]);
  });

  it('발송 증거만 있고 재독 서술이 없으면 finding이 없다(정상적인 서사)', () => {
    const lyrics = '[verse 1]\nThe letter fell into the mailbox slot\n[chorus]\nI walked home slowly in the rain';
    const findings = evaluateObjectState(lyrics, ['letter'], ['letter'], 'english');
    expect(findings).toEqual([]);
  });
});

describe('[지시문 17 TASK B-3] 7개 워크스페이스 정책 전부 등록됨', () => {
  it.each(ALL_WORKSPACE_IDS)('%s — 정책이 존재한다', workspaceId => {
    expect(() => objectStatePolicyForWorkspace(workspaceId)).not.toThrow();
  });

  it('kr-idol-male/female은 빈 목록이다(지시문 원문 "적용 대상 적음")', () => {
    expect(objectStatePolicyForWorkspace('kr-idol-male').kinds).toEqual([]);
    expect(objectStatePolicyForWorkspace('kr-idol-female').kinds).toEqual([]);
  });

  it('워크스페이스마다 kind 목록이 다르다(복사-붙여넣기 아님)', () => {
    const senior = objectStatePolicyForWorkspace('senior-oldpop').kinds;
    const kids = objectStatePolicyForWorkspace('kr-kids').kinds;
    const kr2030 = objectStatePolicyForWorkspace('kr-2030').kinds;
    expect([...senior].sort()).not.toEqual([...kids].sort());
    expect([...senior].sort()).not.toEqual([...kr2030].sort());
  });
});

describe('[지시문 17 TASK B-3/B-5] verified 권한 — kind 단위로만 부여된다', () => {
  it('senior-oldpop은 letter만 verifiedKinds에 있다 — window/light/door/vehicle은 실측 근거가 없어 제외됐다', () => {
    const policy = objectStatePolicyForWorkspace('senior-oldpop');
    expect(policy.verifiedKinds).toEqual(['letter']);
    for (const kind of policy.kinds) {
      if (kind !== 'letter') expect(policy.verifiedKinds).not.toContain(kind);
    }
  });

  it('senior-oldpop의 vehicle(같은 워크스페이스지만 미검증 kind)은 모순 패턴이 있어도 advisory에 그친다 — blocking 아님', () => {
    const lyrics = '[verse 1]\nThe train pulled away from the platform\n[chorus]\nI climbed back on before it left';
    const findings = evaluateObjectState(lyrics, ['vehicle'], [], 'english');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('advisory');
  });

  it('verified:false 워크스페이스(kr-kids)는 실제 정책 그대로 넘겨도 blocking을 내지 않는다', () => {
    const policy = objectStatePolicyForWorkspace('kr-kids');
    expect(policy.verifiedKinds).toEqual([]);
    // door kind 모순을 합성 재현 — kr-kids 정책의 verifiedKinds가 비어 있으므로 advisory여야 한다.
    const lyrics = '[verse 1]\nThe door was closed behind them\n[chorus]\nThey walked through the door laughing';
    const findings = evaluateObjectState(lyrics, policy.kinds, policy.verifiedKinds, 'english');
    expect(findings.every(f => f.severity !== 'blocking')).toBe(true);
  });
});

describe('[지시문 17 TASK B-2] message kind — relationshipContinuity.ts 위임(실측 재사용)', () => {
  it('kr-2030 정책(verifiedKinds 비어 있음)으로 unsent-then-reply 패턴을 돌리면 advisory다', () => {
    const policy = objectStatePolicyForWorkspace('kr-2030');
    const lyrics = '[verse 1]\n차마 보내지 못했던 그 문자\n[chorus]\n네게서 답장이 왔다';
    const findings = evaluateObjectState(lyrics, policy.kinds, policy.verifiedKinds, 'korean');
    const messageFinding = findings.find(f => f.kind === 'message');
    expect(messageFinding).toBeDefined();
    expect(messageFinding!.severity).toBe('advisory');
  });

  it('회상 표지가 있으면 message kind도 finding이 없다(relationshipContinuity.ts 자체 억제 재사용 확인)', () => {
    const policy = objectStatePolicyForWorkspace('kr-2030');
    const lyrics = '[verse 1]\n그때, 차마 보내지 못했던 문자\n[chorus]\n지금은 네게서 답장이 왔다';
    const findings = evaluateObjectState(lyrics, policy.kinds, policy.verifiedKinds, 'korean');
    expect(findings.find(f => f.kind === 'message')).toBeUndefined();
  });
});

describe('[지시문 17 TASK B] vehicle/container/door/window/light — 합성 재현(실측 없음, 아키텍처만 검증)', () => {
  const cases: { kind: ObjectStateKind; contradictionLyrics: string; disclaimerLyrics: string }[] = [
    {
      kind: 'vehicle',
      contradictionLyrics: '[verse 1]\nThe train pulled away from the platform\n[chorus]\nI climbed back on before it left',
      disclaimerLyrics: '[verse 1]\nThe train pulled away from the platform\n[chorus]\nI climbed back on the next train'
    },
    {
      kind: 'container',
      contradictionLyrics: '[verse 1]\nThe box was empty by morning\n[chorus]\nI reached in and found one more inside',
      disclaimerLyrics: '[verse 1]\nThe box was empty by morning\n[chorus]\nI reached into a new box and found one more inside'
    },
    {
      kind: 'door',
      contradictionLyrics: '[verse 1]\nShe closed the door behind her\n[chorus]\nHe walked through the door anyway',
      disclaimerLyrics: '[verse 1]\nShe closed the door behind her\n[chorus]\nHe opened the door and walked through'
    },
    {
      kind: 'window',
      contradictionLyrics: '[verse 1]\nHe shut the window against the cold\n[chorus]\nThe breeze came through the window all night',
      disclaimerLyrics: '[verse 1]\nHe shut the window against the cold\n[chorus]\nHe opened the window and the breeze came through'
    },
    {
      kind: 'light',
      contradictionLyrics: '[verse 1]\nShe turned off the light before bed\n[chorus]\nThe lamp lit the room until dawn',
      disclaimerLyrics: '[verse 1]\nShe turned off the light before bed\n[chorus]\nShe flicked it on again and the lamp lit the room'
    }
  ];

  it.each(cases)('$kind — 모순 패턴은 검출되고, 해명 서술이 인접하면 억제된다', ({ kind, contradictionLyrics, disclaimerLyrics }) => {
    const contradictionFindings = evaluateObjectState(contradictionLyrics, [kind], [kind], 'english');
    expect(contradictionFindings, `${kind} 모순이 검출되지 않음`).toHaveLength(1);
    expect(contradictionFindings[0].severity).toBe('blocking');

    const disclaimerFindings = evaluateObjectState(disclaimerLyrics, [kind], [kind], 'english');
    expect(disclaimerFindings, `${kind} 해명 서술에도 오탐 발생: ${JSON.stringify(disclaimerFindings)}`).toEqual([]);
  });
});

describe('[지시문 17 TASK B-4] 정책 구조 무결성', () => {
  it('OBJECT_STATE_POLICY가 7개 워크스페이스를 전부 커버한다', () => {
    expect(Object.keys(OBJECT_STATE_POLICY).sort()).toEqual([...ALL_WORKSPACE_IDS].sort());
  });

  it('모든 verifiedKinds는 kinds의 부분집합이다(정책 자체 무결성)', () => {
    for (const workspaceId of ALL_WORKSPACE_IDS) {
      const policy = objectStatePolicyForWorkspace(workspaceId);
      for (const verifiedKind of policy.verifiedKinds) {
        expect(policy.kinds).toContain(verifiedKind);
      }
    }
  });
});
