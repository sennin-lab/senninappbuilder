import { useEffect, useState } from "react";
import JSZip from "jszip";
import { BLOCK_DEFS, defOf, makeBlock } from "./blocks";
import { generateProject, slugify } from "./generator";
import { makeTemplate } from "./templates";
import { loadProject, saveProject } from "./storage";
import type { AppKind, BlockType, Method, Project, Route } from "./types";

const KINDS: { kind: AppKind; label: string }[] = [
  { kind: "chat", label: "💬 チャット" },
  { kind: "bbs", label: "📋 掲示板" },
  { kind: "scrape", label: "🔍 情報をとってくる" },
  { kind: "game", label: "🎮 数当てゲーム" },
];

export default function App() {
  const [project, setProject] = useState<Project>(() => loadProject() ?? makeTemplate("chat"));
  const [selectedId, setSelectedId] = useState<string | null>(() => project.routes[0]?.id ?? null);
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [openFile, setOpenFile] = useState<string>("");

  // 作ったものは自動でlocalStorageに保存
  useEffect(() => {
    saveProject(project);
  }, [project]);

  const route = project.routes.find((r) => r.id === selectedId) ?? null;

  const edit = (fn: (p: Project) => Project) => setProject((p) => fn(p));
  const editRoute = (routeId: string, fn: (r: Route) => Route) =>
    edit((p) => ({ ...p, routes: p.routes.map((r) => (r.id === routeId ? fn(r) : r)) }));

  function applyKind(kind: AppKind) {
    const t = makeTemplate(kind);
    const next = { ...t, name: project.name || t.name };
    setProject(next);
    setSelectedId(next.routes[0]?.id ?? null);
    setFiles(null);
  }

  function addRoute() {
    const r: Route = { id: crypto.randomUUID(), method: "GET", path: "/api/new", blocks: [] };
    edit((p) => ({ ...p, routes: [...p.routes, r] }));
    setSelectedId(r.id);
  }

  function removeRoute(id: string) {
    edit((p) => ({ ...p, routes: p.routes.filter((r) => r.id !== id) }));
    setSelectedId(null);
  }

  function addBlock(type: BlockType) {
    if (!route) return;
    editRoute(route.id, (r) => ({ ...r, blocks: [...r.blocks, makeBlock(type)] }));
  }

  function moveBlock(i: number, d: -1 | 1) {
    if (!route) return;
    editRoute(route.id, (r) => {
      const bs = [...r.blocks];
      const j = i + d;
      if (j < 0 || j >= bs.length) return r;
      [bs[i], bs[j]] = [bs[j], bs[i]];
      return { ...r, blocks: bs };
    });
  }

  function removeBlock(i: number) {
    if (!route) return;
    editRoute(route.id, (r) => ({ ...r, blocks: r.blocks.filter((_, k) => k !== i) }));
  }

  function setParam(i: number, key: string, value: string) {
    if (!route) return;
    editRoute(route.id, (r) => ({
      ...r,
      blocks: r.blocks.map((b, k) => (k === i ? { ...b, params: { ...b.params, [key]: value } } : b)),
    }));
  }

  function showCode() {
    const f = generateProject(project);
    setFiles(f);
    setOpenFile(Object.keys(f)[0] ?? "");
  }

  async function download() {
    const f = generateProject(project);
    const zip = new JSZip();
    const root = slugify(project.name);
    for (const [path, content] of Object.entries(f)) zip.file(`${root}/${path}`, content);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${root}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>🧩 senninappbuilder</h1>
        <input
          className="name"
          value={project.name}
          onChange={(e) => edit((p) => ({ ...p, name: e.target.value }))}
          aria-label="アプリの名前"
        />
        <div className="kinds">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              className={project.kind === k.kind ? "kind on" : "kind"}
              onClick={() => applyKind(k.kind)}
            >
              {k.label}
            </button>
          ))}
        </div>
        <button className="primary" onClick={download}>
          📦 ZIPでダウンロード
        </button>
      </header>

      <main className="cols">
        <aside className="palette">
          <h2>ブロック</h2>
          {BLOCK_DEFS.map((d) => (
            <button
              key={d.type}
              className="block"
              style={{ background: d.color }}
              onClick={() => addBlock(d.type)}
              disabled={!route}
              title={d.help}
            >
              {d.label}
            </button>
          ))}
          <p className="hint">ブロックをクリックすると、えらんでいるどうさの下に つながります。</p>
        </aside>

        <section className="editor">
          <h2>どうさ</h2>
          <div className="routes">
            {project.routes.map((r) => (
              <button
                key={r.id}
                className={r.id === selectedId ? "route on" : "route"}
                onClick={() => setSelectedId(r.id)}
              >
                {r.method} {r.path}
              </button>
            ))}
            <button className="route add" onClick={addRoute}>
              ＋ どうさを追加
            </button>
          </div>

          {project.kind === "game" && (
            <p className="hint">数当てゲームは、サーバーを使わず画面だけで動くコードが出力されます。</p>
          )}

          {route ? (
            <div className="route-edit">
              <div className="row">
                <select
                  value={route.method}
                  onChange={(e) => editRoute(route.id, (r) => ({ ...r, method: e.target.value as Method }))}
                >
                  <option>GET</option>
                  <option>POST</option>
                </select>
                <input
                  value={route.path}
                  onChange={(e) => editRoute(route.id, (r) => ({ ...r, path: e.target.value }))}
                />
                <button className="danger" onClick={() => removeRoute(route.id)}>
                  消す
                </button>
              </div>

              <ol className="stack">
                {route.blocks.length === 0 && <li className="empty">左のブロックをえらんで、ならべよう</li>}
                {route.blocks.map((b, i) => {
                  const d = defOf(b.type);
                  return (
                    <li key={b.id} className="stack-item">
                      <div className="stack-head" style={{ background: d.color }} title={d.help}>
                        {d.label}
                      </div>
                      {d.params.map((p) => (
                        <label key={p.key}>
                          {p.label}
                          <input value={b.params[p.key] ?? ""} onChange={(e) => setParam(i, p.key, e.target.value)} />
                        </label>
                      ))}
                      <div className="row">
                        <button onClick={() => moveBlock(i, -1)}>↑</button>
                        <button onClick={() => moveBlock(i, 1)}>↓</button>
                        <button className="danger" onClick={() => removeBlock(i)}>
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <p className="hint">どうさをえらぶか、追加してください。</p>
          )}
        </section>

        <section className="preview">
          <h2>できあがりのコード</h2>
          <button onClick={showCode}>コードを見る</button>
          {files && (
            <>
              <div className="files">
                {Object.keys(files).map((f) => (
                  <button key={f} className={f === openFile ? "file on" : "file"} onClick={() => setOpenFile(f)}>
                    {f}
                  </button>
                ))}
              </div>
              <pre>{files[openFile]}</pre>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
