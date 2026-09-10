# Suno v6 engine compatibility

Suno Weaver Studio uses an additive compatibility layer for the v6 model family. New options start with v6 Production; old options without `sunoEngine` resolve to the same profile without rewriting the saved JSON.

The supported profiles are:

- `v6`: Production, Variety recommendation 0, Standard execution.
- `v6-wild`: Explore, Variety recommendation 50, Standard execution.
- `v6-mini`: Draft, Variety recommendation 0, Standard execution.

Variety and Max are recommendations only. The application has no Suno API integration and does not invent request fields or endpoints. Bridge output carries an additive `sunoEngine` metadata object and a readable `[SUNO ENGINE]` header for the operator.

`compileSunoStylePromptV6` preserves genre, BPM, vocal identity, money chord, structure, scene, and duration before optional clauses. It removes duplicate clauses and skips optional clauses that exceed the app-side 900-character safe budget without cutting a required clause mid-sentence. The 900-character value is an application safety budget, not an official Suno limit.

The existing genre library, vocal presets, money chords, structure planning, lyric policies, bridge-first path, and JP CHILI STORY hard locks remain shared unchanged. The JP Story layer still owns male/female vocal quotas, five acts, source-local scenes, Japanese title/hook generation, and manual genre counts.
