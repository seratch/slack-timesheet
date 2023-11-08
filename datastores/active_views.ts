import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "active_views",
    primary_key: "view_id",
    attributes: {
      view_id: { type: Schema.types.string, required: true },
      user_id: { type: Schema.types.string, required: true },
      last_updated_at: { type: Schema.types.number, required: true }, // epoch time in seconds
      last_updated_callback_id: { type: Schema.types.string, required: true },
    },
  } as const,
);

export default datastore;
