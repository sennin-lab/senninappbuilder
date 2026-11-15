import type { Block, BlockType } from "./types";

export interface ParamDef {
  key: string;
  label: string;
  default: string;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  color: string;
  help: string;
  params: ParamDef[];
  // ブロックが生成するTypeScriptのコード（ハンドラの中に入る行）
  emit: (p: Record<string, string>) => string[];
}

// ブロックの定義。色はScratchのように「たいぷごと」に分けています。
// オレンジ = データ、青 = インターネット、むらさき = 出力
export const BLOCK_DEFS: BlockDef[] = [
  {
    type: "addItem",
    label: "データを追加する",
    color: "#ff8c1a",
    help: "おくられてきた内容を、はこ（データ置き場）に入れます。",
    params: [{ key: "collection", label: "はこの名前", default: "posts" }],
    emit: (p) => [`value = db.add(${JSON.stringify(p.collection)}, req.body);`],
  },
  {
    type: "listItems",
    label: "データを全部取り出す",
    color: "#ff8c1a",
    help: "はこの中のデータを全部わたします。",
    params: [{ key: "collection", label: "はこの名前", default: "posts" }],
    emit: (p) => [`value = db.list(${JSON.stringify(p.collection)});`],
  },
  {
    type: "fetchPage",
    label: "ページを読む",
    color: "#4c97ff",
    help: "インターネットのページを読みこみます。?url= で別のURLも指定できます。",
    params: [{ key: "url", label: "URL", default: "https://example.com" }],
    emit: (p) => [
      `{ const target = String(req.query.url ?? ${JSON.stringify(p.url)});`,
      `  const r = await fetch(target);`,
      `  value = await r.text(); }`,
    ],
  },
  {
    type: "extractText",
    label: "文字をさがして取り出す",
    color: "#4c97ff",
    help: "さがす文字（正規表現）に合う部分を取り出します。()の中が取り出されます。",
    params: [{ key: "pattern", label: "さがす文字", default: "<title>(.*?)</title>" }],
    emit: (p) => [
      `value = [...String(value).matchAll(new RegExp(${JSON.stringify(p.pattern)}, "gi"))].map((m) => m[1] ?? m[0]);`,
    ],
  },
  {
    type: "respond",
    label: "かえす",
    color: "#9966ff",
    help: "ここまでの結果を、アプリにわたします。",
    params: [],
    emit: () => [`return res.json(value);`],
  },
];

export function defOf(type: BlockType): BlockDef {
  const d = BLOCK_DEFS.find((b) => b.type === type);
  if (!d) throw new Error(`unknown block: ${type}`);
  return d;
}

export function makeBlock(type: BlockType): Block {
  const d = defOf(type);
  return {
    id: crypto.randomUUID(),
    type,
    params: Object.fromEntries(d.params.map((p) => [p.key, p.default])),
  };
}
