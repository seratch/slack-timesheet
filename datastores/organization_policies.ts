import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "organization_policies",
    primary_key: "key",
    attributes: {
      key: { type: Schema.types.string },
      value: { type: Schema.types.string },
    },
  } as const,
);

export default datastore;
