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

let _fetchTimeEntry: SavedAttributes<TE> | undefined;
interface fetchTimeEntryArgs {
  te: DataMapper<TE>;
  user: string;
  offset: number;
  yyyymmdd: string | undefined;
}
export async function fetchTimeEntry(
  { te, user, offset, yyyymmdd }: fetchTimeEntryArgs,
): Promise<SavedAttributes<TE>> {
  if (_fetchTimeEntry) return _fetchTimeEntry;
  const _yyyymmdd = yyyymmdd ?? todayYYYYMMDD(offset);
  const response = await te.findById(`${user}-${_yyyymmdd}`);
  _fetchTimeEntry = response.item;
  return _fetchTimeEntry;
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

let _fetchRecentTimeEntries: SavedAttributes<TE>[] | undefined;
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
  if (_fetchRecentTimeEntries) return _fetchRecentTimeEntries;
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
  _fetchRecentTimeEntries = items;
  return _fetchRecentTimeEntries;
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
