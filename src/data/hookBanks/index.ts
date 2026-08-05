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

export function overrideForArchetype(archetype: ChannelArchetype | undefined, language: LyricLanguage): HookVocabularyOverride {
  switch (archetype) {
    case 'showa-cafe':
    case 'showa-70s':
      return showaCafeOverride(language);
    case 'j2000s':
      return seniorMorningOverride;
    case 'kids':
    // TASK D1 §3-2 — jp-kids (not yet built by F1) shares the common-safe
    // kidsOverride() bank D1 built, same reasoning as kr-kids-song used to
    // have here before E1 gave it its own case below — without a case,
    // either would silently fall through to `default` (senior-morning),
    // the exact class of leak C2 found and fixed for jp-2030-pop.
    case 'jp-kids-song':
      return kidsOverride(language);
    // TASK E1 §5-1 — kr-kids workspace's own bank, same reasoning as
    // kr-2030-pop/jp-2030-pop below (own vocabulary, own case).
    case 'kr-kids-song':
      return krKidsOverride(language);
    case 'christmas':
      return christmasOverride;
    case 'lofi-study':
      return lofiStudyOverride;
    // TASK B2 — kr-2030 workspace's single archetype. Added as its own case
    // so it never falls through to the `default` (senior-morning) below.
    case 'kr-2030-pop':
      return kr2030Override(language);
    // TASK C2 — jp-2030 workspace's single archetype, same reasoning as
    // kr-2030-pop above.
    case 'jp-2030-pop':
      return jp2030Override(language);
    case 'senior-morning':
    default:
      return seniorMorningOverride;
  }
}
