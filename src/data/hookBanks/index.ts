import type { ChannelArchetype, LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';
import { seniorMorningOverride } from './seniorMorning';
import { showaCafeOverride } from './showaCafe';
import { christmasOverride } from './christmas';
import { lofiStudyOverride } from './lofiStudy';
import { kidsOverride } from './kids';
import { kr2030Override } from './kr2030';

export function overrideForArchetype(archetype: ChannelArchetype | undefined, language: LyricLanguage): HookVocabularyOverride {
  switch (archetype) {
    case 'showa-cafe':
    case 'showa-70s':
      return showaCafeOverride(language);
    case 'j2000s':
      return seniorMorningOverride;
    case 'kids':
      return kidsOverride(language);
    case 'christmas':
      return christmasOverride;
    case 'lofi-study':
      return lofiStudyOverride;
    // TASK B2 — kr-2030 workspace's single archetype. Added as its own case
    // so it never falls through to the `default` (senior-morning) below.
    case 'kr-2030-pop':
      return kr2030Override(language);
    case 'senior-morning':
    default:
      return seniorMorningOverride;
  }
}
