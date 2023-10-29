import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "admin_users",
    primary_key: "user",
    attributes: {
      user: { type: Schema.types.string },
    },
  } as const,
);

export default datastore;
