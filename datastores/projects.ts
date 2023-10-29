import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "projects",
    primary_key: "code",
    attributes: {
      code: { type: Schema.types.string, required: true },
      name: { type: Schema.types.string, required: true },
      description: { type: Schema.types.string, required: false },
      is_active: { type: Schema.types.boolean, required: true },
    },
  } as const,
);

export default datastore;
