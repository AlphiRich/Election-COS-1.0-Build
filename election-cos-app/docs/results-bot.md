# Results bot

`scripts/results-bot-cli.ts` publishes `/results/feed.json` for the public site's results board. It is `@deployable fails-closed`: with no configured source, an unreadable or invalid feed, or a feed older than the one published, it writes nothing and exits non-zero.

## What is finished
- The feed schema and validation (`src/site/tools/resultsFeed.ts`): municipality codes must exist in the delimitation register, reported voting districts cannot exceed the total, a future-dated feed is refused.
- The board (`/results`): reads the file, rechecks every 30 minutes while open, shows shares of votes counted and labels everything unofficial. No feed means no numbers.
- The bot: validates, never goes backwards, writes atomically.

## What is not finished, and why
The Electoral Commission's results are not published in this schema, and this build has not seen the format they are published in. A converter written without seeing it would be a guess. Someone has to supply the converter, or a feed already in this schema, once the Commission's results source and terms of use are known.

## Running it every 30 minutes
Example scheduler entry (GitHub Actions; not enabled, because it would fail every 30 minutes until a source exists):

```yaml
on:
  schedule: [{ cron: '*/30 * * * *' }]
jobs:
  results:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
        working-directory: election-cos-app
      - run: npx vite-node scripts/results-bot-cli.ts
        working-directory: election-cos-app
        env:
          RESULTS_SOURCE: ${{ secrets.RESULTS_SOURCE }}   # https URL of a feed in this schema
          RESULTS_OUT: dist-site/results/feed.json
      # then publish dist-site/results/feed.json to the site host
```

The published file must be served at `/results/feed.json` on electioncos.co.za.
