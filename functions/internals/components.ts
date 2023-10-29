import { Env } from "deno-slack-sdk/types.ts";
import { SlackAPIClient as BuiltinClient } from "deno-slack-api/types.ts";
import { DataMapper, SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import { SlackAPIClient as SlackAPI } from "slack-web-api-client/mod.ts";

import { todayYYYYMMDD } from "./datetime.ts";
import {
  AU,
  AUMapper,
  C,
  CMapper,
  fetchUserDetails,
  P,
  PH,
  PHMapper,
  PMapper,
  TE,
  TEMapper,
  US,
  USMapper,
} from "./datastore.ts";
import { PrivateMetadata } from "./private_metadata.ts";

export interface ComponentParams {
  env: Env;
  token: string;
  client: BuiltinClient;
  enterprise_id: string;
  team_id: string;
  inputs: { user_id: string };
  // deno-lint-ignore no-explicit-any
  body?: any;
}

export interface Components {
  isDebugMode: boolean;
  canAccessAdminFeature: () => Promise<boolean>;
  logLevel: "DEBUG" | "INFO";
  slackApi: SlackAPI;
  te: DataMapper<TE>;
  c: DataMapper<C>;
  ph: DataMapper<PH>;
  us: DataMapper<US>;
  p: DataMapper<P>;
  au: DataMapper<AU>;
  user: string;
  settings: SavedAttributes<US>;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  yyyymmdd: string;
  offset: number;
  locale: string | undefined;
  language: string;
  country: string | undefined;
}

export async function injectComponents(
  { env, token, client, inputs: { user_id }, body }: ComponentParams,
): Promise<Components> {
  const isDebugMode: boolean = env.DEBUG_MODE !== undefined && (
    env.DEBUG_MODE === "1" ||
    env.DEBUG_MODE === "T" ||
    env.DEBUG_MODE === "TRUE" ||
    env.DEBUG_MODE === "True" ||
    env.DEBUG_MODE === "true"
  );
  const logLevel = isDebugMode ? "DEBUG" : "INFO";
  const slackApi = new SlackAPI(token, { logLevel });
  const user = user_id;
  const userInfo = await fetchUserDetails(slackApi, user_id);
  const timeOffset = userInfo.user?.tz_offset || 0;
  const locale = userInfo.user?.locale;
  const { yyyymmdd }: PrivateMetadata = JSON.parse(
    body?.view?.private_metadata || "{}",
  );
  const _yyyymmdd: string = yyyymmdd
    ? yyyymmdd.toString()
    : todayYYYYMMDD(timeOffset);
  let language = locale ? locale.split("-")[0] : "en";
  let country = locale && locale.split("-")[1];

  const us = USMapper(client, logLevel);
  const settings = (await us.findById(user)).item;
  if (settings.user) {
    language = settings.language;
    country = settings.country_id;
  }

  const ph = PHMapper(client, logLevel);
  const holidays = async () => {
    const year = _yyyymmdd.substring(0, 4);
    return (await ph.findById(`${country}-${year}`)).item;
  };

  const au = AUMapper(client, logLevel);
  const canAccessAdminFeature = async () => {
    const items = (await au.findAll({ limit: 1 })).items;
    const noAdminUsers = items === undefined || items.length === 0;
    if (noAdminUsers) return true;
    const thisUserCanAccess = (await au.findById(user)).item.user !== undefined;
    return thisUserCanAccess;
  };

  return {
    isDebugMode,
    canAccessAdminFeature,
    logLevel,
    slackApi,
    us,
    user,
    locale,
    language,
    country,
    settings,
    te: TEMapper(client, logLevel),
    c: CMapper(client, logLevel),
    ph,
    p: PMapper(client, logLevel),
    au,
    holidays,
    yyyymmdd: _yyyymmdd,
    offset: timeOffset,
  };
}
