# 지시문 36 A/B 청취 비교 세트

senior-oldpop-floor(channelSoundFloor.ts)의 forbiddenAtoms 4종(modern wide stereo production / sub bass / digital synth pads / sidechain compression)과 requiredAtoms 1종(narrow warm stereo image)을 뺐을 때 70년대 느낌이 유지되는지 확인하기 위한 실측 비교 세트입니다.

- **A-set**: 현재 그대로 (아무것도 바꾸지 않음)
- **B-set**: 위 5줄만 제거, 나머지는 A와 완전히 동일
- 채널: oldpop-lounge-main / 컨셉: "70년대 추억이 느껴지는 올드팝"

## 사용법
1. 아래 A-set 3곡의 Style/Exclude를 그대로 Suno에 붙여넣어 생성 → 듣기
2. 아래 B-set 3곡(같은 트랙과 짝을 이룸)의 Style/Exclude를 Suno에 붙여넣어 생성 → 듣기
3. A와 B를 비교해서 판정:
   - ① 70년대 느낌 유지 + 사운드도 괜찮다 → TASK A 진행 (strictOnly 계층화)
   - ② 70년대 느낌이 사라진다 → forbiddenAtoms/requiredAtoms 유지, TASK A는 하지 않음
   - ③ 둘 다 아니다 → 원인이 다른 곳에 있음, 재조사 필요

## Track 1: Coming

### A-set
**Style:**
```
female low warm contralto, light rhythmic phrasing, faint vibrato shimmer, warm natural room, clear unhurried diction, straight 4/4 pop feel, clean strummed acoustic, sustained piano pads, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, pre-chorus adds simple diatonic lift without swing or solo, I-vi-IV-V doo-wop progression, no instrumental intro, hook heard immediately, 3:10-3:35, hook repeats 4x, pre-chorus dropout, warm adult contemporary pop, clean strummed acoustic guitar, warm analog studio sound, acoustic instruments carry the arrangement, narrow warm stereo image, moderate arrangement, a few instruments at a time, two voices enter in harmony immediately, opening is as loud and full as the chorus, nostalgic, 66 BPM
```
**Exclude:**
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting
```

### B-set (narrow warm stereo image 제거)
**Style:**
```
female low warm contralto, light rhythmic phrasing, faint vibrato shimmer, warm natural room, clear unhurried diction, straight 4/4 pop feel, clean strummed acoustic, sustained piano pads, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, pre-chorus adds simple diatonic lift without swing or solo, I-vi-IV-V doo-wop progression, no instrumental intro, hook heard immediately, 3:10-3:35, hook repeats 4x, pre-chorus dropout, warm adult contemporary pop, clean strummed acoustic guitar, warm analog studio sound, acoustic instruments carry the arrangement, moderate arrangement, a few instruments at a time, two voices enter in harmony immediately, opening is as loud and full as the chorus, nostalgic, 66 BPM
```
**Exclude:** (4줄 제거: modern wide stereo production / sub bass / digital synth pads / sidechain compression)
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, abrupt dynamic jumps, cavernous hall reverb, gated reverb, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting
```

## Track 2: Light the Evening Star

### A-set
**Style:**
```
straight 4/4 pop feel, no swing, sustained piano pads, no solo, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, hook entry lands cleanly on the downbeat, warm adult contemporary pop, slow waltz or 4/4 cafe pulse, short intro, 3:10-3:35, full arrangement, not a short cut, hook repeats 4x, octave-lift final chorus, alternating verses into joined chorus, wide octave harmony, soft plate ambience, male and female duet, clear unhurried diction, musette accordion, clean strummed acoustic guitar, I-V-vi-IV progression, gentle tremolo electric guitar intro texture (INTRO ONLY), warm analog studio sound, acoustic instruments carry the arrangement, narrow warm stereo image, spare, voice-forward arrangement, lots of space, full ensemble unison on the final hook, opens with one distinctive instrumental sound, full arrangement from the first bar, nostalgic, 84 BPM
```
**Exclude:**
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, swing
```

### B-set (narrow warm stereo image 제거)
**Style:**
```
straight 4/4 pop feel, no swing, sustained piano pads, no solo, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, hook entry lands cleanly on the downbeat, warm adult contemporary pop, slow waltz or 4/4 cafe pulse, short intro, 3:10-3:35, full arrangement, not a short cut, hook repeats 4x, octave-lift final chorus, alternating verses into joined chorus, wide octave harmony, soft plate ambience, male and female duet, clear unhurried diction, musette accordion, clean strummed acoustic guitar, I-V-vi-IV progression, gentle tremolo electric guitar intro texture (INTRO ONLY), warm analog studio sound, acoustic instruments carry the arrangement, spare, voice-forward arrangement, lots of space, full ensemble unison on the final hook, opens with one distinctive instrumental sound, full arrangement from the first bar, nostalgic, 84 BPM
```
**Exclude:** (4줄 제거: modern wide stereo production / sub bass / digital synth pads / sidechain compression)
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, swing
```

## Track 3: Wake

### A-set
**Style:**
```
rounded electric bass, straight 4/4 pop feel, clean strummed acoustic, no swing, no solo, warm adult contemporary pop, short intro, 3:10-3:35, full arrangement, not a short cut, hook repeats 4x, doubled hook harmony, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, pre-chorus adds simple diatonic lift without swing or solo, male mid baritone-tenor lead, storytelling spoken-edge delivery, smoky low resonance, chamber ambience, clear unhurried diction, I-V-vi-IV progression, muted acoustic strum intro texture (INTRO ONLY), warm analog studio sound, acoustic instruments carry the arrangement, narrow warm stereo image, spare, voice-forward arrangement, lots of space, three-part harmony on the last chorus, intro plays the chorus melody first, no quiet fade-in — already at full level from the start, nostalgic, 88 BPM
```
**Exclude:**
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, sidechain compression, modern wide stereo production, digital synth pads, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, swing
```

### B-set (narrow warm stereo image 제거)
**Style:**
```
rounded electric bass, straight 4/4 pop feel, clean strummed acoustic, no swing, no solo, warm adult contemporary pop, short intro, 3:10-3:35, full arrangement, not a short cut, hook repeats 4x, doubled hook harmony, Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, pre-chorus adds simple diatonic lift without swing or solo, male mid baritone-tenor lead, storytelling spoken-edge delivery, smoky low resonance, chamber ambience, clear unhurried diction, I-V-vi-IV progression, muted acoustic strum intro texture (INTRO ONLY), warm analog studio sound, acoustic instruments carry the arrangement, spare, voice-forward arrangement, lots of space, three-part harmony on the last chorus, intro plays the chorus melody first, no quiet fade-in — already at full level from the start, nostalgic, 88 BPM
```
**Exclude:** (4줄 제거: modern wide stereo production / sub bass / digital synth pads / sidechain compression)
```
famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, shouted or belted high notes, aggressive distorted percussion, heavy sub bass, rapid syllable-dense phrasing, harsh bright top end, excessive reverb washing out the vocal, dense syncopation that obscures the melody, cavernous hall reverb, gated reverb, autotuned vocal, trap hi-hats, lo-fi vinyl crackle effect, flat chorus with no lift, monotonous melody contour, generic AI demo-band sound, overly glossy karaoke backing track, muddy low-end mix, thin placeholder hook, stock loop arrangement with no song development, too old-fashioned trot mood, childish lyrics, dramatic power ballad shouting, swing
```
