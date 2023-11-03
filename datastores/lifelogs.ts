import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "lifelogs",
    primary_key: "user_and_date",
    attributes: {
      // user_id + "-" + YYYYMMDD
      user_and_date: { type: Schema.types.string },
      logs: {
        type: Schema.types.array,
        items: {
          // JSON format
          type: Schema.types.string,
        },
        required: true,
      },
    },
  } as const,
);

export default datastore;
