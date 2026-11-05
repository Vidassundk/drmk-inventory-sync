// GitHub drops most `schedule:` runs on this repo, so this Worker starts the workflows on time instead.
const REPO = "Vidassundk/drmk-inventory-sync";

/** Cron expression (see wrangler.jsonc) -> workflow file to start. */
const WORKFLOWS: Record<string, string> = {
  "17 * * * *": "images-rehost.yml",
  "4,19,34,49 * * * *": "rrr-sync-incremental.yml",
  "41 2 * * *": "rrr-sync-full.yml",
};

type Env = { GITHUB_TOKEN: string };

export default {
  async scheduled(controller: ScheduledController, env: Env) {
    const workflow = WORKFLOWS[controller.cron];
    if (!workflow) throw new Error(`No workflow for cron "${controller.cron}"`);

    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "drmk-scheduler",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    });
    if (!res.ok) throw new Error(`Starting ${workflow} failed: HTTP ${res.status} ${await res.text()}`);
    console.log(`Started ${workflow}`);
  },
} satisfies ExportedHandler<Env>;
