import type { ChannelArchetype, LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';
import { seniorMorningOverride } from './seniorMorning';
import { showaCafeOverride } from './showaCafe';
import { christmasOverride } from './christmas';
import { lofiStudyOverride } from './lofiStudy';
import { kidsOverride } from './kids';
import { kr2030Override } from './kr2030';
import { jp2030Override } from './jp2030';
import { krKidsOverride } from './krKids';
import { jpKidsOverride } from './jpKids';
import { krIdolMaleOverride } from './krIdolMale';
import { krIdolFemaleOverride } from './krIdolFemale';
import { modernChillOverride } from './modernChill';
import { cityNightOverride } from './cityNight';

export function overrideForArchetype(archetype: ChannelArchetype | undefined, language: LyricLanguage): HookVocabularyOverride {
  switch (archetype) {
    case 'showa-cafe':
    case 'showa-70s':
      return showaCafeOverride(language);
    case 'j2000s':
      return seniorMorningOverride;
    case 'kids':
      return kidsOverride(language);
    // TASK E1 §5-1 — kr-kids workspace's own bank, same reasoning as
    // kr-2030-pop/jp-2030-pop below (own vocabulary, own case).
    case 'kr-kids-song':
      return krKidsOverride(language);
    // TASK F1 §7-1 — jp-kids workspace's own bank, same reasoning as
    // kr-kids-song above. Without this case it would silently fall through
    // to `default` (senior-morning) — the exact class of leak C2 found and
    // fixed for jp-2030-pop, and §0-2 re-measured for this workspace.
    case 'jp-kids-song':
      return jpKidsOverride(language);
    case 'christmas':
      return christmasOverride;
    case 'lofi-study':
      return lofiStudyOverride;
    // v5.17 (TASK C, isolation audit L4 fix) — 'twenties'/'thirtiesForties'
    // audience archetypes (data/presets.ts's own chill-hours/city-night-drive
    // channels), NOT the senior cohort senior-morning's vocabulary targets.
    // Before this case existed, each silently fell through to `default`
    // (senior-morning's REAL vocabulary) — a genuine audience-mismatched
    // runtime leak. Now returns its own empty, "Deferred" bank instead — the
    // SAME category as christmas/lofi-study just above, just deferred for a
    // different reason (audience-appropriate vocabulary not yet written,
    // rather than build order) — see modernChill.ts/cityNight.ts's own doc
    // comments and scripts/isolationAudit.ts's L4_INTENTIONAL_SENIOR_MATCH.
    case 'modern-chill':
      return modernChillOverride;
    case 'city-night':
      return cityNightOverride;
    // v5.17 (TASK C, isolation audit L4 fix) — unlike modern-chill/city-night
    // above, oldpop-lounge's own audience IS 'seniors' (see
    // utils/channelProfile.ts's ARCHETYPE_AUDIENCE map) — the exact same
    // cohort senior-morning's hook vocabulary already targets, and
    // data/channelSoundFloor.ts already groups oldpop-lounge with
    // senior-morning/showa-cafe/showa-70s as one family for the same reason.
    // Reusing seniorMorningOverride here is a deliberate, documented
    // decision (same shape as j2000s's own case below), not an accidental
    // switch fallthrough — see scripts/isolationAudit.ts's
    // L4_INTENTIONAL_SENIOR_MATCH, which now references this comment.
    case 'oldpop-lounge':
      return seniorMorningOverride;
    // TASK B2 — kr-2030 workspace's single archetype. Added as its own case
    // so it never falls through to the `default` (senior-morning) below.
    case 'kr-2030-pop':
      return kr2030Override(language);
    // TASK C2 — jp-2030 workspace's single archetype, same reasoning as
    // kr-2030-pop above.
    case 'jp-2030-pop':
      return jp2030Override(language);
    // TASK K2 §8-1 — kr-idol-male workspace's own bank, same reasoning as
    // kr-2030-pop/jp-2030-pop above. Without this case it would silently
    // fall through to `default` (senior-morning) — the exact class of leak
    // C2/F1 both found and fixed for their own workspaces.
    case 'kr-idol-male':
      return krIdolMaleOverride(language);
    // TASK K3 §6-1 — kr-idol-female workspace's own bank, same reasoning as
    // kr-idol-male above.
    case 'kr-idol-female':
      return krIdolFemaleOverride(language);
    case 'senior-morning':
    default:
      return seniorMorningOverride;
  }
}
