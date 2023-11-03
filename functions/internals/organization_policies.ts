import { DataMapper } from "deno-slack-data-mapper/mod.ts";
import { OP } from "./datastore.ts";
import { Label } from "./constants.ts";

export interface OrganizationPolicyDetails {
  label: string;
  values: OrganizationPolicyValueDetails[];
  mustSelectOne: boolean;
}
export interface OrganizationPolicyValueDetails {
  value: string;
  label: string;
}
export const OrganizationPolices: Record<string, OrganizationPolicyDetails> =
  {};

export class OrganizationPolicyKey {
  static IsManualEntryPermitted = "is_manual_entry_permitted";
  static Country = "country";
}

export class OrganizationPolicyValue {
  static Permitted = "permitted";
  static Restricted = "restricted";
  static Japan = "jp";
  static UnitedStates = "us";
}

// slack datastore put '{"datastore":"organization_policies","item": {"key":"is_manual_entry_permitted","value":"restricted"}}'
OrganizationPolices[OrganizationPolicyKey.IsManualEntryPermitted] = {
  label: Label.ManualEntryPermitted,
  values: [
    {
      value: OrganizationPolicyValue.Permitted,
      label: Label.OrganizationPolicyValue_Permitted,
    },
    {
      value: OrganizationPolicyValue.Restricted,
      label: Label.OrganizationPolicyValue_Restricted,
    },
  ],
  mustSelectOne: true,
};
OrganizationPolices[OrganizationPolicyKey.Country] = {
  label: Label.Country,
  values: [
    { value: OrganizationPolicyValue.Japan, label: Label.Japan },
    { value: OrganizationPolicyValue.UnitedStates, label: Label.UnitedStates },
  ],
  mustSelectOne: false,
};

interface isManualEntryPermittedArgs {
  op: DataMapper<OP>;
}
export async function isManualEntryPermitted(
  { op }: isManualEntryPermittedArgs,
): Promise<boolean> {
  const row = await op.findById(OrganizationPolicyKey.IsManualEntryPermitted);
  const value: string | undefined = row.item.value;
  if (value) {
    return value !== OrganizationPolicyValue.Restricted;
  }
  return true;
}

interface fetchOrganizationCountryIdArgs {
  op: DataMapper<OP>;
}
export async function fetchOrganizationCountryId(
  { op }: fetchOrganizationCountryIdArgs,
): Promise<string | undefined> {
  const row = await op.findById(OrganizationPolicyKey.Country);
  return row.item.value;
}
