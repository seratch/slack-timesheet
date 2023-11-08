import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import workflow from "../workflows/active_view_refresher.ts";

const trigger: Trigger<typeof workflow.definition> = {
  type: TriggerTypes.Scheduled,
  name: "Active View Refresher",
  description: "Start a periodical job to refresh active views",
  workflow: `#/workflows/${workflow.definition.callback_id}`,
  schedule: {
    // This start_time means 5 seconds after you run `slack trigger create` command
    start_time: new Date(new Date().getTime() + 5_000).toISOString(),
    frequency: { type: "daily" },
  },
  inputs: {},
};
export default trigger;
