import { DataMapper } from "deno-slack-data-mapper/mod.ts";
import { OP } from "./datastore.ts";
import { Label } from "./constants.ts";

export interface OrganizationPolicyDetails {
  label: string;
  values: OrganizationPolicyValueDetails[];
}
export interface OrganizationPolicyValueDetails {
  value: string;
  label: string;
}
export const OrganizationPolices: Record<string, OrganizationPolicyDetails> =
  {};

export class OrganizationPolicyKey {
  static IsManualEntryPermitted = "is_manual_entry_permitted";
}

export class OrganizationPolicyValue {
  static Permitted = "permitted";
  static Restricted = "restricted";
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
