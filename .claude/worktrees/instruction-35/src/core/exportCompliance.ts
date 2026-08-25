import type { ChannelProfile, SongIdea } from '../types';
import { isKidsArchetype } from '../utils/channelArchetype';

/**
 * TASK v3.39.1 Part B4/C2 — the actual mechanism YouTube requires is the
 * Studio upload flow's "Altered or synthetic content" toggle, not description
 * text by itself, but stating it in the description too is standard,
 * policy-safe creator practice and is the one part of the disclosure this
 * app can actually write on the creator's behalf. Kept as one plain factual
 * sentence — no health/political-content exemption language, since that
 * doesn't apply to a music channel.
 */
export const AI_DISCLOSURE_LINE = 'This video uses AI-assisted, synthetic music generated with Suno.';

/**
 * TASK v3.58 (TASK 5-5) — YoutubeMetadata.description is required to state
 * AI_DISCLOSURE_LINE (a deliberate, single, policy-facing sentence that
 * legitimately contains "AI" and "Suno"), but the discrete tags field is
 * public discoverability metadata, not disclosure copy — a tag like "suno
 * ai music" or "ai generated song" is keyword-stuffing that invites the
 * exact "inauthentic/synthetic content" scrutiny a channel doesn't want to
 * flag itself for, and gains nothing the description's own disclosure
 * doesn't already cover. core/localGenerator.ts's own seoKeywords/genre/mood
 * tag sources never contained these, but core/claudeCodeBridge.ts accepts a
 * remote model's tags array completely unfiltered — this is the actual
 * leak this task's own report measured. Only ever applied to `tags`, never
 * to `description` or `title`, which must keep the disclosure sentence
 * intact.
 */
const PUBLIC_TAG_BLOCKLIST_PATTERN = /\b(suno|udio|ai[- ]?generated|ai[- ]?music|ai[- ]?song|ai[- ]?cover|artificial intelligence|chatgpt|openai|claude|gpt|synthetic music|synthetic vocal|generative music)\b/i;

export function sanitizePublicYoutubeTags(tags: string[]): string[] {
  return tags.filter(tag => tag.trim() && !PUBLIC_TAG_BLOCKLIST_PATTERN.test(tag));
}

export function isMadeForKidsChannel(channel: Pick<ChannelProfile, 'archetype'>): boolean {
  return isKidsArchetype(channel.archetype);
}

/**
 * TASK v3.39.1 Part D2 — core/quality.ts's scoreSong already runs a
 * copyright/imitation/famous-artist-name/blocked-token check on every song
 * and folds any hit into song.warnings as prose alongside every other
 * warning category (length, missing tags, etc). This filters those back out
 * so an export can surface them as their own explicit pre-upload Content ID
 * checklist item instead of leaving a reviewer to spot them inside a mixed
 * warnings list.
 */
export function extractContentIdFlags(song: Pick<SongIdea, 'warnings'>): string[] {
  return song.warnings.filter(warning => /copyright|famous artist|artist filter|imitation/i.test(warning));
}

/**
 * TASK v3.39.1 Part B4 — a plain-language checklist for the human upload
 * step this app deliberately doesn't automate (see core/videoLedger.ts's own
 * "no OAuth" note). The Made-for-Kids line always comes first: it's the
 * single highest-consequence checkbox in the whole upload flow (COPPA —
 * disables personalized ads, comments, end screens, cards, and Super Thanks
 * for that video if set wrong either way).
 */
export function buildUploadChecklist(channel: Pick<ChannelProfile, 'archetype' | 'name'>, contentIdFlags: string[] = []): string[] {
  const madeForKids = isMadeForKidsChannel(channel);
  const checklist = [
    madeForKids
      ? `Set "Made for Kids" = YES for every video from ${channel.name} (COPPA) — this disables personalized ads, comments, end screens, cards, and Super Thanks for the video.`
      : `Set "Made for Kids" = NO for every video from ${channel.name}, unless this specific upload is genuinely child-directed content.`,
    'Studio upload flow: answer YES to "Altered or synthetic content" and pick the music/vocal category, per YouTube\'s synthetic-media disclosure policy.',
    'Confirm this pack was generated while a paid Suno Pro/Premier subscription was active — the free tier carries no commercial usage rights, and rights are not granted retroactively.',
    'Suno provides no copyright indemnification for generated output — review the Content ID flags below (if any) before publishing.'
  ];
  if (contentIdFlags.length) {
    checklist.push(...contentIdFlags.map(flag => `Content ID review: ${flag}`));
  }
  return checklist;
}
