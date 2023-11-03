import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "user_settings",
    primary_key: "user",
    attributes: {
      user: { type: Schema.types.string },
      // To support more languages, modify functions/internals/i18n.ts
      language: { type: Schema.types.string, required: true },
      // reference to countries.id
      country_id: { type: Schema.types.string, required: false },
      // work, work_and_lifelogs
      app_mode: { type: Schema.types.string, required: false },
    },
  } as const,
);

export default datastore;
