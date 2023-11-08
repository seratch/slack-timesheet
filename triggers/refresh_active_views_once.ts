import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import workflow from "../workflows/active_view_refresher_once.ts";

const trigger: Trigger<typeof workflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Refresh Active Views",
  description: "Refresh all the active views now",
  workflow: `#/workflows/${workflow.definition.callback_id}`,
  inputs: {},
};
export default trigger;
