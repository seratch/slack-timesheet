import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import workflow from "../workflows/timesheet.ts";

const trigger: Trigger<typeof workflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "タイムシート",
  description: "クリックするとタイムシート（実働時間管理アプリ）が起動します",
  workflow: `#/workflows/${workflow.definition.callback_id}`,
  inputs: {
    interactivity: { value: TriggerContextData.Shortcut.interactivity },
    user_id: { value: TriggerContextData.Shortcut.user_id },
  },
};
export default trigger;
