import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { def as RunTimesheet } from "../functions/run_timesheet.ts";

const workflow = DefineWorkflow({
  callback_id: "timesheet_workflow",
  title: "Timesheet",
  description: "Workflow to launch an app to manage work hours within Slack",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "user_id"],
  },
});
workflow.addStep(RunTimesheet, workflow.inputs);
export default workflow;
