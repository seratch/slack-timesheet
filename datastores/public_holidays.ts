import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

const datastore = DefineDatastore(
  {
    name: "public_holidays",
    primary_key: "country_id_and_year",
    attributes: {
      // countries.id + "-" + year (e.g., jp-2023)
      country_id_and_year: { type: Schema.types.string },
      holidays: {
        type: Schema.types.array,
        // The items must be the YYYYMMDD format
        items: { type: Schema.types.string },
        required: true,
      },
    },
  } as const,
);

export default datastore;
