import { makeBlock } from "./blocks";
import type { AppKind, Block, BlockType, Project, Route } from "./types";

function block(type: BlockType, params: Record<string, string> = {}): Block {
  const b = makeBlock(type);
  return { ...b, params: { ...b.params, ...params } };
}

function route(method: "GET" | "POST", path: string, blocks: Block[]): Route {
  return { id: crypto.randomUUID(), method, path, blocks };
}

// テンプレート：ここから作って、ブロックを入れ替えたり足したりします
export function makeTemplate(kind: AppKind): Project {
  switch (kind) {
    case "chat":
      return {
        name: "チャットアプリ",
        kind,
        routes: [
          route("POST", "/api/messages", [block("addItem", { collection: "messages" }), block("respond")]),
          route("GET", "/api/messages", [block("listItems", { collection: "messages" }), block("respond")]),
        ],
      };
    case "bbs":
      return {
        name: "掲示板",
        kind,
        routes: [
          route("POST", "/api/posts", [block("addItem", { collection: "posts" }), block("respond")]),
          route("GET", "/api/posts", [block("listItems", { collection: "posts" }), block("respond")]),
        ],
      };
    case "scrape":
      return {
        name: "情報をとってくるアプリ",
        kind,
        routes: [
          route("GET", "/api/scrape", [
            block("fetchPage", { url: "https://example.com" }),
            block("extractText", { pattern: "<title>(.*?)</title>" }),
            block("respond"),
          ]),
        ],
      };
    case "game":
      // ゲームはサーバーを使わず、画面だけで動くコードを出力します
      return { name: "数当てゲーム", kind, routes: [] };
  }
}
