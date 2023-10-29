import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "countries",
    primary_key: "id",
    attributes: {
      id: { type: Schema.types.string },
      label: { type: Schema.types.string, required: true },
    },
  } as const,
);

export default datastore;
