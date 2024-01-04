import { assertEquals } from "std/assert/assert_equals.ts";
import { reportStartBlocks } from "./views.ts";
import { LanguageCode } from "./constants.ts";
import { AnyModalBlock } from "slack-web-api-client/index.ts";
import { StaticSelect, ViewInputBlock } from "slack-web-api-client/mod.ts";

Deno.test("reportStartBlocks", () => {
  const blocks: AnyModalBlock[] = [];
  reportStartBlocks({
    language: LanguageCode.English,
    offset: 0,
    blocks,
    isLifelogEnabled: true,
  });
  assertEquals(blocks.length, 3);
  const year = (blocks[0] as ViewInputBlock).element as StaticSelect;
  assertEquals(
    year.options?.map((o) => o.value).includes(year.initial_option?.value),
    true,
  );
  const month = (blocks[1] as ViewInputBlock).element as StaticSelect;
  assertEquals(
    month.options?.map((o) => o.value).includes(month.initial_option?.value),
    true,
  );
});
