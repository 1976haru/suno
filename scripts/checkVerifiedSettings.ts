/**
 * 지시문 12 (TASK C-4) — "검증된 설정 계약" 실행기. 25개 프리셋 채널 ×
 * VERIFIED_SETTING_CONTRACTS(9종 이상)를 돌며, 그 설정의 scope 안에 있는
 * 채널마다 check(channel)을 호출한다. applied가 false면 SETTING LOST로
 * 기록한다.
 *
 * Usage: npx tsx scripts/checkVerifiedSettings.ts
 */
import { channelPresets } from '../src/data/presets';
import { VERIFIED_SETTING_CONTRACTS, inScope } from '../src/core/verifiedSettingContract';

interface SettingRow {
  channelId: string;
  settingId: string;
  verifiedByKo: string;
  observed: string;
  expected: string;
  reasonKo?: string;
}

function main() {
  const lost: SettingRow[] = [];
  const notApplicable: SettingRow[] = [];
  let appliedCount = 0;
  let lostCount = 0;
  let naCount = 0;

  console.log(`[check:settings] ${channelPresets.length}채널 × 등록 설정 ${VERIFIED_SETTING_CONTRACTS.length}종\n`);

  for (const contract of VERIFIED_SETTING_CONTRACTS) {
    for (const channel of channelPresets) {
      if (!inScope(channel, contract)) continue;
      const result = contract.check(channel);
      const row: SettingRow = {
        channelId: channel.id,
        settingId: contract.settingId,
        verifiedByKo: contract.verifiedByKo,
        observed: result.observed,
        expected: result.expected,
        reasonKo: result.reasonKo
      };
      if (result.status === 'applied') {
        appliedCount += 1;
      } else if (result.status === 'n/a') {
        naCount += 1;
        notApplicable.push(row);
      } else {
        lostCount += 1;
        lost.push(row);
      }
    }
  }

  for (const l of lost) {
    console.log(`✗ SETTING LOST  ${l.channelId} / ${l.settingId}`);
    console.log(`    기대: ${l.expected}`);
    console.log(`    실제: ${l.observed}`);
    console.log(`    근거: ${l.verifiedByKo}\n`);
  }

  if (notApplicable.length) {
    console.log(`--- N/A (설계상 미적용 — ${notApplicable.length}건) ---`);
    for (const n of notApplicable) {
      console.log(`○ N/A  ${n.channelId} / ${n.settingId}`);
      console.log(`    사유: ${n.reasonKo}\n`);
    }
  }

  console.log(`적용 ${appliedCount} / 유실 ${lostCount} / N/A ${naCount}`);

  if (lostCount > 0) {
    process.exitCode = 1;
  }
}

main();
