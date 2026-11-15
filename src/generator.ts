import { defOf } from "./blocks";
import type { AppKind, Project, Route } from "./types";

export function slugify(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "my-app";
}

// ---------- バックエンド（Node.js + Express + TypeScript） ----------

function routeHandler(r: Route): string[] {
  const body: string[] = [];
  for (const b of r.blocks) body.push(...defOf(b.type).emit(b.params));
  if (!r.blocks.some((b) => b.type === "respond")) body.push("return res.json(value);");
  return [
    `app.${r.method.toLowerCase()}(${JSON.stringify(r.path)}, async (req, res) => {`,
    `  try {`,
    `    let value: any = null;`,
    ...body.map((l) => "    " + l),
    `  } catch (e) {`,
    `    res.status(500).json({ error: String(e) });`,
    `  }`,
    `});`,
    ``,
  ];
}

const DB_TS = [
  `import fs from "node:fs";`,
  `import path from "node:path";`,
  ``,
  `// データは data.json に保存されます（インストール不要で、中身もテキストとして見られます）`,
  `const FILE = path.resolve(process.cwd(), "data.json");`,
  `type Row = { id: number; createdAt: string; [key: string]: unknown };`,
  `type Store = Record<string, Row[]>;`,
  ``,
  `function read(): Store {`,
  `  if (!fs.existsSync(FILE)) return {};`,
  `  return JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;`,
  `}`,
  ``,
  `function write(store: Store) {`,
  `  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));`,
  `}`,
  ``,
  `export const db = {`,
  `  add(collection: string, item: Record<string, unknown>): Row {`,
  `    const store = read();`,
  `    const row: Row = { ...item, id: Date.now(), createdAt: new Date().toISOString() };`,
  `    store[collection] = [...(store[collection] ?? []), row];`,
  `    write(store);`,
  `    return row;`,
  `  },`,
  `  list(collection: string): Row[] {`,
  `    return read()[collection] ?? [];`,
  `  },`,
  `};`,
  ``,
].join("\n");

function genBackend(p: Project): Record<string, string> {
  const server = [
    `import express from "express";`,
    `import path from "node:path";`,
    `import { db } from "./db.js";`,
    ``,
    `const app = express();`,
    `app.use(express.json());`,
    ``,
    ...p.routes.flatMap(routeHandler),
    `// 画面（frontend）のコードをビルドした場所を表示します`,
    `app.use(express.static(path.resolve(process.cwd(), "../frontend/dist")));`,
    ``,
    `const PORT = Number(process.env.PORT ?? 3000);`,
    `app.listen(PORT, () => console.log("起動しました: http://localhost:" + PORT));`,
    ``,
  ].join("\n");

  const pkg = {
    name: slugify(p.name) + "-backend",
    private: true,
    type: "module",
    scripts: { start: "tsx server.ts" },
    dependencies: { express: "^4.21.0" },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/node": "^22.0.0",
      tsx: "^4.19.0",
      typescript: "^5.5.4",
    },
  };

  return {
    "backend/server.ts": server,
    "backend/db.ts": DB_TS,
    "backend/package.json": JSON.stringify(pkg, null, 2) + "\n",
  };
}

// ---------- フロントエンド（React + TypeScript + Vite） ----------

const STYLES = `body { margin: 0; font-family: "Hiragino Sans", "Yu Gothic", sans-serif; background: #f5f7ff; }
.app { max-width: 640px; margin: 0 auto; padding: 24px; }
h1 { color: #4c3dbb; }
.form { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.form input { flex: 1; min-width: 120px; padding: 10px; border: 2px solid #c9d3ff; border-radius: 10px; font-size: 16px; }
button { padding: 10px 16px; border: none; border-radius: 10px; background: #4c97ff; color: white; font-size: 16px; cursor: pointer; }
button:disabled { background: #aab; }
.list { list-style: none; padding: 0; }
.list li { background: white; border-radius: 12px; padding: 12px; margin-bottom: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
.list li b { color: #ff8c1a; margin-right: 8px; }
`;

function chatApp(p: Project): string {
  const postPath = p.routes.find((r) => r.method === "POST")?.path ?? "/api/posts";
  const listPath = p.routes.find((r) => r.method === "GET")?.path ?? "/api/posts";
  const title = p.kind === "chat" ? "チャット" : "掲示板";
  return `import { useEffect, useState } from "react";
import "./styles.css";

type Item = { id: number; createdAt: string; name?: string; text?: string };

const POST_PATH = ${JSON.stringify(postPath)};
const LIST_PATH = ${JSON.stringify(listPath)};

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");

  async function load() {
    const res = await fetch(LIST_PATH);
    setItems(await res.json());
  }

  async function send() {
    if (!text.trim()) return;
    await fetch(POST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "名無し", text }),
    });
    setText("");
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="app">
      <h1>${title}</h1>
      <div className="form">
        <input placeholder="なまえ" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="メッセージ"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button onClick={send}>おくる</button>
      </div>
      <ul className="list">
        {items.map((it) => (
          <li key={it.id}>
            <b>{it.name}</b>
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;
}

function scrapeApp(p: Project): string {
  const path = p.routes.find((r) => r.method === "GET")?.path ?? "/api/scrape";
  return `import { useState } from "react";
import "./styles.css";

const SCRAPE_PATH = ${JSON.stringify(path)};

export default function App() {
  const [url, setUrl] = useState("https://example.com");
  const [result, setResult] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch(SCRAPE_PATH + "?url=" + encodeURIComponent(url));
    setResult(await res.json());
    setLoading(false);
  }

  return (
    <div className="app">
      <h1>情報をとってくるアプリ</h1>
      <div className="form">
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        <button onClick={run} disabled={loading}>
          {loading ? "とってきています…" : "とってくる"}
        </button>
      </div>
      <ul className="list">
        {result.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
`;
}

// ゲームはサーバーを使わず、画面だけで動きます
function gameApp(): string {
  return `import { useState } from "react";
import "./styles.css";

function newAnswer() {
  return Math.floor(Math.random() * 100) + 1;
}

export default function App() {
  const [answer, setAnswer] = useState(newAnswer);
  const [guess, setGuess] = useState("");
  const [count, setCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  function check() {
    const n = Number(guess);
    if (!Number.isInteger(n) || n < 1 || n > 100) return;
    const c = count + 1;
    setCount(c);
    if (n === answer) {
      setLog([...log, n + ": 正解！ " + c + "回でした"]);
      setDone(true);
    } else {
      setLog([...log, n + ": " + (n < answer ? "もっと大きい" : "もっと小さい")]);
    }
    setGuess("");
  }

  function restart() {
    setAnswer(newAnswer());
    setCount(0);
    setLog([]);
    setDone(false);
    setGuess("");
  }

  return (
    <div className="app">
      <h1>数当てゲーム</h1>
      <p>1から100までの数を当ててください。</p>
      {!done ? (
        <div className="form">
          <input
            type="number"
            placeholder="数字"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") check();
            }}
          />
          <button onClick={check}>けってい</button>
        </div>
      ) : (
        <button onClick={restart}>もう一回あそぶ</button>
      )}
      <ul className="list">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
`;
}

function genFrontend(p: Project): Record<string, string> {
  const app = (kind: AppKind) => {
    if (kind === "game") return gameApp();
    if (kind === "scrape") return scrapeApp(p);
    return chatApp(p);
  };

  const pkg = {
    name: slugify(p.name) + "-frontend",
    private: true,
    type: "module",
    scripts: { dev: "vite", build: "tsc --noEmit && vite build" },
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
    devDependencies: {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.1",
      typescript: "^5.5.4",
      vite: "^5.4.0",
    },
  };

  return {
    "frontend/package.json": JSON.stringify(pkg, null, 2) + "\n",
    "frontend/index.html": `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${p.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    "frontend/vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } },
});
`,
    "frontend/tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["src"],
      },
      null,
      2,
    ) + "\n",
    "frontend/src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
    "frontend/src/App.tsx": app(p.kind),
    "frontend/src/styles.css": STYLES,
  };
}

// ---------- 全体 ----------

export function generateProject(p: Project): Record<string, string> {
  const readme = `# ${p.name}

このフォルダには、あなたのアプリのコードが入っています。

## 動かしかた

1. パソコンに Node.js（https://nodejs.org ）を入れます。
2. frontend フォルダで「npm install」→「npm run build」を実行します。
3. backend フォルダで「npm install」→「npm start」を実行します。
4. ブラウザで http://localhost:3000 をひらきます。

データは backend/data.json に保存されます。

## 大事なやくそく

インターネットのページを読むときは、そのサイトのルール（利用規約や robots.txt）を守りましょう。
`;
  return {
    "README.md": readme,
    ...genBackend(p),
    ...genFrontend(p),
  };
}
