import { DefineWorkflow } from "deno-slack-sdk/mod.ts";
import { def as RefreshMainViews } from "../functions/refresh_main_views.ts";

const workflow = DefineWorkflow({
  callback_id: "active_view_refresher_once",
  title: "Active View Refresher (once)",
  description: "Workflow to refresh active views",
  input_parameters: { properties: {}, required: [] },
});

workflow.addStep(RefreshMainViews, {});

export default workflow;
