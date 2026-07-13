import type { ChannelArchetype, LyricLanguage } from '../../types';
import type { HookVocabularyOverride } from '../hookParts';
import { seniorMorningOverride } from './seniorMorning';
import { showaCafeOverride } from './showaCafe';
import { christmasOverride } from './christmas';
import { lofiStudyOverride } from './lofiStudy';
import { kidsOverride } from './kids';

export function overrideForArchetype(archetype: ChannelArchetype | undefined, language: LyricLanguage): HookVocabularyOverride {
  switch (archetype) {
    case 'showa-cafe':
      return showaCafeOverride(language);
    case 'kids':
      return kidsOverride(language);
    case 'christmas':
      return christmasOverride;
    case 'lofi-study':
      return lofiStudyOverride;
    case 'senior-morning':
    default:
      return seniorMorningOverride;
  }
}
