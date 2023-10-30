import { assertEquals } from "std/assert/assert_equals.ts";
import { i18n } from "./i18n.ts";
import { Label } from "./constants.ts";

Deno.test("i18n", () => {
  assertEquals(i18n(Label.Add, "ja"), "追加");
  assertEquals(i18n("XXX", "ja"), "XXX");
  assertEquals(i18n("", "ja"), "");
});
