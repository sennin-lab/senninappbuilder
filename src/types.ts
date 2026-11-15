// ブロックの種類（小学生にもわかるように、日本語のラベルは blocks.ts にあります）
export type BlockType = "addItem" | "listItems" | "fetchPage" | "extractText" | "respond";

export type Method = "GET" | "POST";

// アプリの種類
export type AppKind = "chat" | "bbs" | "scrape" | "game";

export interface Block {
  id: string;
  type: BlockType;
  params: Record<string, string>;
}

// 「どうさ」1つ分。例: POST /api/messages にきたら、ブロックを上から順に実行する
export interface Route {
  id: string;
  method: Method;
  path: string;
  blocks: Block[];
}

export interface Project {
  name: string;
  kind: AppKind;
  routes: Route[];
}
