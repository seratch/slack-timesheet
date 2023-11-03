export interface Entry {
  start: string;
  end: string;
  project_code?: string | undefined;
  what_to_do?: string | undefined;
  // This can be used only in app code, not in the datastore
  type?: string | undefined;
}

export interface TimeEntry {
  start: string;
  end: string;
  project_code?: string | undefined;
}

export interface Lifelog {
  what_to_do: string;
  start: string;
  end?: string;
}

export function serializeEntry(
  entry: Entry | TimeEntry | Lifelog | string,
): string {
  if (typeof entry === "string") {
    return serializeEntry(deserializeEntry(entry as string)!);
  }
  const copy = JSON.parse(JSON.stringify(entry));
  delete copy.type;
  // return `${entry.start},${entry.end || ""},${entry.project_code || ""}`;
  return JSON.stringify(copy);
}

export function deserializeEntry(
  value: string,
  // deno-lint-ignore no-inferrable-types
  removeType: boolean = false,
): Entry | undefined {
  if (!value) return undefined;
  if (value.startsWith("{")) {
    const entity = JSON.parse(value) as Entry;
    if (removeType) {
      delete entity.type;
    }
    return entity;
  }
  // To support the legacy format
  const elems = value.split(",");
  let entry: Entry | undefined;
  if (elems.length === 2) {
    entry = {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      project_code: undefined,
      what_to_do: undefined,
      type: undefined,
    };
  } else if (elems.length === 3) {
    entry = {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      what_to_do: undefined,
      project_code: elems[2] === "" ? undefined : elems[2],
      type: undefined,
    };
  } else if (elems.length === 4) {
    entry = {
      start: elems[0],
      end: elems[1] ? elems[1] : "",
      what_to_do: undefined,
      project_code: elems[2] === "" ? undefined : elems[2],
      type: elems[3] === "" ? undefined : elems[3],
    };
  } else {
    return undefined;
  }
  if (entry && removeType) {
    delete entry.type;
  }
  return entry;
}

export function toComparable(entry: Entry | undefined): string {
  if (!entry) return "";
  const projectCode = entry.project_code
    ? encodeURIComponent(entry.project_code)
    : "";
  const whatToDo = entry.what_to_do ? encodeURIComponent(entry.what_to_do) : "";
  return [
    `type:${entry.type || ""}`,
    `start:${entry.start || ""}`,
    `end:${entry.end || ""}`,
    `project_code:${projectCode}`,
    `what_to_do:${whatToDo}`,
  ].join("\t");
}
