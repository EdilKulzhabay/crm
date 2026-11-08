import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTwoGisUrl } from "../twoGisUrl.js";

describe("normalizeTwoGisUrl", () => {
    test("пустое значение — ссылки нет", () => {
        assert.equal(normalizeTwoGisUrl(""), "");
        assert.equal(normalizeTwoGisUrl("   "), "");
        assert.equal(normalizeTwoGisUrl(undefined), "");
    });

    test("ссылки 2ГИС принимаются, http заменяется на https", () => {
        assert.equal(normalizeTwoGisUrl(" https://2gis.kz/almaty/firm/70000001234567 "), "https://2gis.kz/almaty/firm/70000001234567");
        assert.equal(normalizeTwoGisUrl("http://go.2gis.com/abcd1"), "https://go.2gis.com/abcd1");
        assert.equal(normalizeTwoGisUrl("https://m.2gis.ru/moscow/geo/1"), "https://m.2gis.ru/moscow/geo/1");
    });

    test("чужие домены, похожие домены и опасные схемы отклоняются", () => {
        for (const bad of [
            "javascript:alert(1)",
            "https://evil.com/2gis.kz",
            "https://2gis.kz.evil.com/x",
            "https://not2gis.kz/x",
            "https://user:pass@2gis.kz/x",
            "ftp://2gis.kz/x",
            "2gis.kz/almaty",
            `https://2gis.kz/${"a".repeat(600)}`,
        ]) {
            assert.equal(normalizeTwoGisUrl(bad), null, bad);
        }
    });
});
