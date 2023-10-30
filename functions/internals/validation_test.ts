import { assertEquals } from "std/assert/assert_equals.ts";
import { areAllCharsAllowedForProjectCode } from "./validation.ts";

Deno.test("areAllCharsAllowedForProjectCode", () => {
  assertEquals(areAllCharsAllowedForProjectCode(""), true);
  assertEquals(areAllCharsAllowedForProjectCode("123abcABC_-"), true);
  assertEquals(areAllCharsAllowedForProjectCode("123abcABC_-$"), false);
  assertEquals(areAllCharsAllowedForProjectCode("123abcABC_-\\"), false);
  assertEquals(areAllCharsAllowedForProjectCode("123abc  ABC_-"), false);
  assertEquals(areAllCharsAllowedForProjectCode("123abc日本語"), false);
});
