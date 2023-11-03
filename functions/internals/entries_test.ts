import { assertEquals } from "std/assert/assert_equals.ts";
import { serializeEntry, toComparable } from "./entries.ts";

Deno.test("serializeEntry", () => {
  assertEquals(
    serializeEntry({
      type: "work",
      start: "09:00",
      end: "18:00",
    }),
    '{"start":"09:00","end":"18:00"}',
  );
});

Deno.test("toComparable", () => {
  assertEquals(
    toComparable({
      type: "work",
      start: "09:00",
      end: "18:00",
      project_code: "foo",
    }),
    "type:work\tstart:09:00\tend:18:00\tproject_code:foo\twhat_to_do:",
  );
  assertEquals(
    toComparable({
      type: "lifelog",
      start: "09:00",
      end: "18:00",
      what_to_do: "lesson",
    }),
    "type:lifelog\tstart:09:00\tend:18:00\tproject_code:\twhat_to_do:lesson",
  );
  assertEquals(
    toComparable({
      start: "09:00",
      end: "18:00",
    }),
    "type:\tstart:09:00\tend:18:00\tproject_code:\twhat_to_do:",
  );
});
