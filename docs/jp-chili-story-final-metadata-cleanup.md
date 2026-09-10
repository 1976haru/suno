# JP Chili Story final metadata cleanup

This change keeps the instruction 84 Story contract on the official bridge path.

- `storyPlanLine` is parsed during contract normalization and its episode, source title, source event, POV title, and POV intent are copied into the shared source fields. Explicit structured fields still win over parsed fallbacks.
- Japanese Story packs replace the legacy `Autumn to Christmas Playlist Pack` title with a source-aware `Tokyo Chill Love Story` title and use `Story Neutral` unless a season was explicitly chosen or supplied by the source episode.
- Solo male/female Story packs normalize the display channel and retain the existing vocal hard lock and Japanese title/hook rules.
- Non-Cafe Japanese Story packs skip the generic concept-to-Cafe fit heuristic. Explicit unsupported genre selections still pass through genre sanitization and keep their warning.
- Japanese Story scene instructions now require source-local micro-scene variation: small actions, timing, sensory detail, inner interpretation, and the unchosen word may change while place, cast, and relationship stage remain inside the source episode.

Measured by `tests/jpChillhopPov.test.ts`:

- EP.001 train first-meeting: 15 female scenes + 15 male scenes; all source-local; future-stage violations 0.
- Solo vocal lock: male 15/15 male and female 15/15 female.
- Manual genre counts: male `4/4/4/3` and female `4/4/4/3`, matching the requested ids in preallocation, SetPlan, and bridge instruction output.
- Train window/Cafe false-positive: no warning without an explicit unsupported genre; explicit unsupported genre still warns.
