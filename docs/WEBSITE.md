# Website design and publication

The website is a view of the public repository. An experiment is authored in
`ideas/<category>/<slug>/idea.md`; contributors do not maintain a second website list.
The site build generates experiment pages, catalog pages, search shards, counts,
field notes, open questions and the scoreboard from those records.

## Reading and discovery

The homepage starts with twelve server-rendered experiments. Category pages and
the complete archive work without JavaScript. Interactive search reads compact
public records in files of at most 100 items, with at most three requests in
flight. Unfiltered browsing loads only the pages needed for the requested result
page. A search or filter scans all search shards before reporting a complete count;
full idea bodies and the private intake inventory are never search payloads.
Search covers titles, verdicts, tags and lessons. Twelve results render at a time.

Search, filters, sorting and page number are reflected in the URL so a reader can
share a view or return to it. Failed requests preserve the last readable results
and offer retry and a link to the static archive. Scores are labeled as calculated
library scores; they are not endorsements or independent evidence.

## Design decisions and research

The visual direction uses editorial hierarchy, open result rows, and a physical
archive object. The custom still-life was modeled and rendered in Blender using
original procedural geometry, materials and lighting, without stock assets.
The distributed WebP is covered by the repository's MIT license.

The research informed the decisions; it does not establish that visitors prefer
this particular implementation. No user study has been run on the redesign.

- [Nielsen Norman Group: aesthetic and minimalist design](https://www.nngroup.com/articles/aesthetic-minimalist-design/)
  distinguishes useful visual richness from irrelevant decoration. The primary
  browsing controls remain prominent; typography and composition carry the design.
- [Baymard: applied filters](https://baymard.com/blog/how-to-design-applied-filters)
  supports visible selections, removable filters and clear result counts. Its
  commerce findings are applied here as a design inference.
- [Webdesign discussion: preventing the AI slop look](https://www.reddit.com/r/webdesign/comments/1uhuovu/preventing_the_ai_slop_look/)
  criticizes repeated templates, decorative modules and unnecessary reveal effects.
  This is practitioner opinion, not a representative survey.
- [Europeana's exploration interface](https://www.europeana.eu/en/explore) and
  [Library of Congress search guidance](https://www.loc.gov/help/search/)
  demonstrate search alongside topic browsing. These are interface references,
  not evidence that popularity follows from a particular layout.

The site uses system fonts, explicit focus states, reduced-motion support and no
analytics scripts. Experiment and category pages share the same visual language.
No new paid service or visitor account is required.

## Checks before publication

Run `npm run check`. It validates source records, scans public output, checks
deterministic generation and exercises additions, escaping and withdrawals.
Browser review must cover search, combined filters, clearing, pagination, returning
from a record, unanswered questions and contribution navigation. Test narrow and
wide layouts, as well as the static fallback and failure message.

Cloudflare Pages builds every main-branch repository update with `npm run check`.
This setting was verified directly in the Pages project configuration, replacing
the earlier generation-only command that skipped validation and privacy gates. Only the
generated `site/dist` directory is public; source inventory stays ignored and
outside the deployment output. Versioned CSS and JavaScript URLs prevent the
browser from retaining the previous design after a deploy.
