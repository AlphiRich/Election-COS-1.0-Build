/**
 * Election Campaign OS — results bot entry point.
 * @deployable fails-closed (see results-bot.ts)
 */
import { runBot } from './results-bot';

runBot({
  source: process.env.RESULTS_SOURCE,
  out: process.env.RESULTS_OUT ?? 'dist-site/results/feed.json',
}).then((r) => {
  if (r.published)
    console.log(
      `Published ${r.municipalities} municipality result sets generated ${r.generatedAt}.`,
    );
  else {
    console.error(`Not published: ${r.reason}`);
    process.exit(1);
  }
});
