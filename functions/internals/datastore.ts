import { SlackAPIClient as Client } from "deno-slack-api/types.ts";
import {
  Attributes,
  DataMapper,
  Operator,
  SavedAttributes,
} from "deno-slack-data-mapper/mod.ts";

import TimeEntries from "../../datastores/time_entries.ts";
import UserSettings from "../../datastores/user_settings.ts";
import Countries from "../../datastores/countries.ts";
import PublicHolidays from "../../datastores/public_holidays.ts";
import AdminUsers from "../../datastores/admin_users.ts";
import Projects from "../../datastores/projects.ts";
import OrganizationPolicies from "../../datastores/organization_policies.ts";

import { todayYYYYMMDD } from "./datetime.ts";
import { CountryCode, Label } from "./constants.ts";

export type LogLevel = "DEBUG" | "INFO";

export type TE = typeof TimeEntries.definition;
export type US = typeof UserSettings.definition;
export type C = typeof Countries.definition;
export type PH = typeof PublicHolidays.definition;
export type AU = typeof AdminUsers.definition;
export type P = typeof Projects.definition;
export type OP = typeof OrganizationPolicies.definition;

// -----------------------------------------
// DataMapper initializer
// -----------------------------------------

function createDataMapper<DEF extends TE | US | C | PH | AU | P | OP>(
  def: DEF,
  client: Client,
  logLevel: LogLevel,
): DataMapper<DEF> {
  return new DataMapper<DEF>({
    datastore: def,
    client,
    logLevel,
  });
}

export function TEMapper(client: Client, logLevel: LogLevel): DataMapper<TE> {
  return createDataMapper(TimeEntries.definition, client, logLevel);
}
export function USMapper(client: Client, logLevel: LogLevel): DataMapper<US> {
  return createDataMapper(UserSettings.definition, client, logLevel);
}
export function CMapper(client: Client, logLevel: LogLevel): DataMapper<C> {
  return createDataMapper(Countries.definition, client, logLevel);
}
export function PHMapper(client: Client, logLevel: LogLevel): DataMapper<PH> {
  return createDataMapper(PublicHolidays.definition, client, logLevel);
}
export function AUMapper(client: Client, logLevel: LogLevel): DataMapper<AU> {
  return createDataMapper(AdminUsers.definition, client, logLevel);
}
export function PMapper(client: Client, logLevel: LogLevel): DataMapper<P> {
  return createDataMapper(Projects.definition, client, logLevel);
}
export function OPMapper(client: Client, logLevel: LogLevel): DataMapper<OP> {
  return createDataMapper(OrganizationPolicies.definition, client, logLevel);
}

// -----------------------------------------
// TimeEntries
// -----------------------------------------

export interface TimeEntry {
  start: string;
  end: string;
  project_code: string | undefined;
}
export interface EnhancedTimeEntry extends TimeEntry {
  // This can be used only in app code, not in the datastore
  type: string | undefined;
}

export function serializeTimeEntry(entry: TimeEntry): string {
  return `${entry.start},${entry.end || ""},${entry.project_code || ""}`;
}

export function deserializeTimeEntry(
  value: string,
): EnhancedTimeEntry | undefined {
  if (!value) return undefined;
  const elems = value.split(",");
  if (elems.length === 2) {
    return {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      project_code: undefined,
      type: undefined,
    };
  } else if (elems.length === 3) {
    return {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      project_code: elems[2] === "" ? undefined : elems[2],
      type: undefined,
    };
  } else if (elems.length === 4) {
    return {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      project_code: elems[2] === "" ? undefined : elems[2],
      type: elems[3] === "" ? undefined : elems[3],
    };
  } else {
    return undefined;
  }
}

interface fetchTimeEntryArgs {
  te: DataMapper<TE>;
  user: string;
  offset: number;
  yyyymmdd: string | undefined;
}
export async function fetchTimeEntry(
  { te, user, offset, yyyymmdd }: fetchTimeEntryArgs,
): Promise<SavedAttributes<TE>> {
  const _yyyymmdd = yyyymmdd ?? todayYYYYMMDD(offset);
  const response = await te.findById(`${user}-${_yyyymmdd}`);
  return response.item;
}

interface fetchMonthTimeEntriesArgs {
  te: DataMapper<TE>;
  user: string;
  yyyymm: string;
}
export async function fetchMonthTimeEntries({
  te,
  user,
  yyyymm,
}: fetchMonthTimeEntriesArgs): Promise<SavedAttributes<TE>[]> {
  const where = {
    user_and_date: {
      value: `${user}-${yyyymm}`,
      operator: Operator.BeginsWith,
    },
  };
  const monthlyEntries = await te.findAllBy({ where });
  const items = monthlyEntries.items.sort((a, b) => {
    if (!a.user_and_date || !b.user_and_date) return 0;
    return a.user_and_date > b.user_and_date ? 1 : -1;
  });
  return items;
}

export async function fetchAllMemberMonthTimeEntries(
  { te, yyyymm }: fetchMonthTimeEntriesArgs,
): Promise<Record<string, SavedAttributes<TE>[]>> {
  const where = {
    user_and_date: {
      value: `-${yyyymm}`,
      operator: Operator.Contains,
    },
  };
  const allEntries = await te.findAllBy({ where });
  const allItems = allEntries.items.sort((a, b) => {
    if (!a.user_and_date || !b.user_and_date) return 0;
    return a.user_and_date > b.user_and_date ? 1 : -1;
  });
  const result: Record<string, SavedAttributes<TE>[]> = {};
  for (const item of allItems) {
    const user = item.user_and_date!.split("-")[0];
    result[user] = result[user] || [];
    result[user].push(item);
  }
  return result;
}

interface fetchRecentTimeEntriesArgs {
  te: DataMapper<TE>;
  user: string;
  yyyymm: string;
  limit: number;
}
export async function fetchRecentTimeEntries({
  te,
  user,
  yyyymm,
  limit,
}: fetchRecentTimeEntriesArgs): Promise<SavedAttributes<TE>[]> {
  const monthsToSearch: string[] = [yyyymm];
  let year = yyyymm.substring(0, 4);
  let month = yyyymm.substring(4, 6);
  if (month === "01") {
    year = (Number.parseInt(year) - 1).toString();
    month = "12";
  } else {
    month = (Number.parseInt(month) - 1).toString();
  }
  monthsToSearch.push(year + ("00" + month).slice(-2));
  const conditions = monthsToSearch.map((_yyyymm) => {
    return {
      user_and_date: {
        value: `${user}-${_yyyymm}`,
        operator: Operator.BeginsWith,
      },
    };
  });
  const where = { or: conditions };
  const entries = await te.findAllBy({ where, limit });
  const items = entries.items.sort((a, b) => {
    if (!a.user_and_date || !b.user_and_date) return 0;
    return a.user_and_date > b.user_and_date ? 1 : -1;
  });
  return items;
}

interface saveTimeEntryArgs {
  te: DataMapper<TE>;
  attributes: Attributes<TE>;
}
export async function saveTimeEntry(
  { te, attributes }: saveTimeEntryArgs,
): Promise<SavedAttributes<TE>> {
  return (await te.save({ attributes })).item;
}

// -----------------------------------------
// UserSettings
// -----------------------------------------

interface saveUserSettingsArgs {
  us: DataMapper<US>;
  attributes: Attributes<US>;
}
export async function saveUserSettings(
  { us, attributes }: saveUserSettingsArgs,
): Promise<SavedAttributes<US>> {
  return (await us.save({ attributes })).item;
}

// -----------------------------------------
// Countries
// -----------------------------------------

interface fetchAllCountriesArgs {
  c: DataMapper<C>;
}
export async function fetchAllCountries(
  { c }: fetchAllCountriesArgs,
): Promise<SavedAttributes<C>[]> {
  return (await c.findAll()).items;
}

const DefaultCountries: Attributes<C>[] = [
  { id: CountryCode.Japan, label: Label.Japan },
  { id: CountryCode.UnitedStates, label: Label.UnitedStates },
];
interface setupCountriesAndHolidaysIfNecessaryArgs {
  countries: SavedAttributes<C>[];
  c: DataMapper<C>;
  ph: DataMapper<PH>;
}
export async function setupCountriesAndHolidaysIfNecessary(
  { countries, c, ph }: setupCountriesAndHolidaysIfNecessaryArgs,
): Promise<SavedAttributes<C>[]> {
  if (countries.length !== DefaultCountries.length) {
    for (const attributes of DefaultCountries) {
      await c.save({ attributes });
    }
    for (const attributes of DefaultPublicHolidays) {
      await ph.save({ attributes });
    }
    return (await c.findAll()).items;
  }
  return countries;
}

// -----------------------------------------
// PublicHolidays
// -----------------------------------------

const DefaultPublicHolidays: Attributes<PH>[] = [
  {
    country_id_and_year: CountryCode.Japan + "-2023",
    holidays: [
      "20230101",
      "20230102",
      "20230109",
      "20230211",
      "20230223",
      "20230321",
      "20230429",
      "20230503",
      "20230504",
      "20230505",
      "20230717",
      "20230811",
      "20230918",
      "20230923",
      "20231009",
      "20231103",
      "20231123",
    ],
  },
  {
    country_id_and_year: CountryCode.Japan + "-2024",
    holidays: [
      "20240101",
      "20240108",
      "20240211",
      "20240212",
      "20240223",
      "20240320",
      "20240429",
      "20240503",
      "20240504",
      "20240505",
      "20240506",
      "20240715",
      "20240811",
      "20240812",
      "20240916",
      "20240922",
      "20241014",
      "20241103",
      "20241104",
      "20241123",
    ],
  },
];

// -----------------------------------------
// Projects
// -----------------------------------------

interface saveProjectArgs {
  p: DataMapper<P>;
  attributes: Attributes<P>;
}
export async function saveProject(
  { p, attributes }: saveProjectArgs,
): Promise<SavedAttributes<P>> {
  return (await p.save({ attributes })).item;
}

interface fetchAllProjectsArgs {
  p: DataMapper<P>;
}
export async function fetchAllProjects(
  { p }: fetchAllProjectsArgs,
): Promise<SavedAttributes<P>[]> {
  const items = (await p.findAll()).items;
  items.sort((a, b) => a.code > b.code ? 1 : -1);
  return items;
}
export async function fetchAllActiveProjects(
  { p }: fetchAllProjectsArgs,
): Promise<SavedAttributes<P>[]> {
  const items = (await p.findAllBy({ where: { is_active: true } })).items;
  items.sort((a, b) => a.code > b.code ? 1 : -1);
  return items;
}
export async function hasActiveProjects(
  { p }: fetchAllProjectsArgs,
): Promise<boolean> {
  return (await p.findAllBy({
    where: { is_active: true },
    limit: 1,
  })).items.length > 0;
}

interface fetchProjectArgs {
  p: DataMapper<P>;
  code: string;
}
export async function fetchProject(
  { p, code }: fetchProjectArgs,
): Promise<SavedAttributes<P>> {
  const response = await p.findById(code);
  return response.item;
}
