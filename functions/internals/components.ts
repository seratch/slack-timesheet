import { Env } from "deno-slack-sdk/types.ts";
import { SlackAPIClient as BuiltinClient } from "deno-slack-api/types.ts";
import { DataMapper, SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import { SlackAPIClient as SlackAPI } from "slack-web-api-client/mod.ts";

import { todayYYYYMMDD } from "./datetime.ts";
import {
  AU,
  AUMapper,
  AV,
  AVMapper,
  C,
  CMapper,
  L,
  LMapper,
  OP,
  OPMapper,
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
import { fetchUserDetails } from "./slack_api.ts";
import { AppModeCode } from "./constants.ts";
import { determineIsDebugMode, determineLogLevel } from "./debug_mode.ts";

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
  isLifelogEnabled: boolean;
  logLevel: "DEBUG" | "INFO";
  slackApi: SlackAPI;
  te: DataMapper<TE>;
  c: DataMapper<C>;
  ph: DataMapper<PH>;
  us: DataMapper<US>;
  p: DataMapper<P>;
  op: DataMapper<OP>;
  au: DataMapper<AU>;
  l: DataMapper<L>;
  av: DataMapper<AV>;
  user: string;
  email: string;
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
  const isDebugMode: boolean = determineIsDebugMode(env);
  const logLevel = determineLogLevel(env);
  const slackApi = new SlackAPI(token, { logLevel });
  const user = user_id;
  const userInfo = await fetchUserDetails({ slackApi, user: user_id });
  if (!userInfo.user) {
    throw new Error(
      `Unexpectedly failed to fetch users.info data! (user: ${user_id})`,
    );
  }
  const timeOffset = userInfo.user.tz_offset || 0;
  const email = userInfo.user.profile!.email!;
  const locale = userInfo.user.locale;
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
    if (!settings.offset || settings.offset !== timeOffset) {
      const attributes = { ...settings };
      attributes.offset = timeOffset;
      await us.save({ attributes });
    }
  }

  const ph = PHMapper(client, logLevel);
  const holidays = buildHolidays(ph, country, _yyyymmdd);

  const au = AUMapper(client, logLevel);
  const canAccessAdminFeature = buildCanAccessAdminFeature(au, user);

  return {
    isDebugMode,
    canAccessAdminFeature,
    isLifelogEnabled: settings.app_mode === AppModeCode.WorkAndLifelogs,
    logLevel,
    slackApi,
    us,
    user,
    email,
    locale,
    language,
    country,
    settings,
    te: TEMapper(client, logLevel),
    c: CMapper(client, logLevel),
    ph,
    p: PMapper(client, logLevel),
    op: OPMapper(client, logLevel),
    au,
    l: LMapper(client, logLevel),
    av: AVMapper(client, logLevel),
    holidays,
    yyyymmdd: _yyyymmdd,
    offset: timeOffset,
  };
}

export function buildCanAccessAdminFeature(
  au: DataMapper<AU>,
  user: string,
): () => Promise<boolean> {
  let _canAccessAdminFeature: boolean | undefined;
  const canAccessAdminFeature = async () => {
    if (_canAccessAdminFeature) return _canAccessAdminFeature;
    const items = (await au.findAll({ limit: 1 })).items;
    const noAdminUsers = items === undefined || items.length === 0;
    if (noAdminUsers) {
      _canAccessAdminFeature = true;
      return _canAccessAdminFeature;
    }
    const thisUserCanAccess = (await au.findById(user)).item.user !== undefined;
    _canAccessAdminFeature = thisUserCanAccess;
    return _canAccessAdminFeature;
  };
  return canAccessAdminFeature;
}

export function buildHolidays(
  ph: DataMapper<PH>,
  country: string | undefined,
  _yyyymmdd: string,
): () => Promise<SavedAttributes<PH> | undefined> {
  let _holidays: SavedAttributes<PH> | undefined;
  const holidays = async () => {
    if (country === undefined) return undefined;
    if (_holidays) return _holidays;
    const year = _yyyymmdd.substring(0, 4);
    _holidays = (await ph.findById(`${country}-${year}`)).item;
    return _holidays;
  };
  return holidays;
}
