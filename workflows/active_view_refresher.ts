import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as RefreshMainViews } from "../functions/refresh_main_views.ts";

const workflow = DefineWorkflow({
  callback_id: "active_view_refresher",
  title: "Active View Refresher",
  description: "Workflow to refresh active views",
  input_parameters: { properties: {}, required: [] },
});

const executionsPerHour = 2;
const delayMinutes = 60 / executionsPerHour;
for (let i = 0; i < executionsPerHour * 24; i++) {
  workflow.addStep(RefreshMainViews, {});
  workflow.addStep(Schema.slack.functions.Delay, {
    minutes_to_delay: delayMinutes,
  });
}

export default workflow;
