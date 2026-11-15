import type { Project } from "./types";

// 作りかけの作品はブラウザのlocalStorageに保存します
const KEY = "senninappbuilder:project";

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function saveProject(p: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 容量オーバーなどのときは保存しないだけにします
  }
}
