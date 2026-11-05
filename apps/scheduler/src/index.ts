// GitHub drops most `schedule:` runs on this repo, so this Worker starts the workflows on time instead.
const REPO = "Vidassundk/drmk-inventory-sync";

/** Cron expression (see wrangler.jsonc) -> workflow file to start. */
const WORKFLOWS: Record<string, string> = {
  "17 * * * *": "images-rehost.yml",
  "4,19,34,49 * * * *": "rrr-sync-incremental.yml",
  "41 2 * * *": "rrr-sync-full.yml",
};

/** Waits before each retry. GitHub's 5xx errors are usually gone within seconds. */
const RETRY_DELAYS_MS = [5_000, 15_000];

type Env = { GITHUB_TOKEN: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function dispatch(workflow: string, token: string) {
  return fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "drmk-scheduler",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main" }),
  });
}

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    const workflow = WORKFLOWS[controller.cron];
    if (!workflow) throw new Error(`No workflow for cron "${controller.cron}"`);

    for (let attempt = 0; ; attempt++) {
      const res = await dispatch(workflow, env.GITHUB_TOKEN).catch((err: Error) => err);
      if (res instanceof Response && res.ok) {
        console.log(`Started ${workflow}`);
        return;
      }

      const reason = res instanceof Response ? `HTTP ${res.status} ${await res.text()}` : res.message;
      // A 4xx means the token or workflow is wrong, and trying again won't change that.
      const retryable = !(res instanceof Response) || res.status >= 500;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw new Error(`Starting ${workflow} failed: ${reason}`);

      console.warn(`Starting ${workflow} failed, retrying: ${reason}`);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  },
} satisfies ExportedHandler<Env>;
