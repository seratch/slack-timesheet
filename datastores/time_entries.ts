import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "time_entries",
    primary_key: "user_and_date",
    attributes: {
      // user_id + "-" + YYYYMMDD
      user_and_date: { type: Schema.types.string },
      work_entries: {
        type: Schema.types.array,
        items: {
          // JSON format: start, end, project_code
          type: Schema.types.string,
        },
        required: true,
      },
      break_time_entries: {
        type: Schema.types.array,
        items: {
          // JSON format: start, end
          type: Schema.types.string,
        },
        required: false,
      },
      time_off_entries: {
        type: Schema.types.array,
        items: {
          // JSON format: start, end
          type: Schema.types.string,
        },
        required: false,
      },
    },
  } as const,
);

export default datastore;
