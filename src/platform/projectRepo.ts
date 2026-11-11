// iOS: expo-file-system。保存先 Paths.document/projects/<id>/{project.json, source.png}
import { Directory, File, Paths } from 'expo-file-system';

import { parseProject, serializeProject } from '@/core/file/project';
import type { ProjectSummary } from '@/core/file/project';

import { byUpdatedDesc, type ProjectRepo, summarize } from './projectRepo.types';

const root = () => new Directory(Paths.document, 'projects');

function projectDir(id: string): Directory {
  const dir = new Directory(root(), id);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** 一時ファイルに書いてから置き換える（書き込み中に落ちても project.json が壊れないように）。 */
async function writeAtomic(dir: Directory, name: string, content: string | Uint8Array): Promise<void> {
  const tmp = new File(dir, `${name}.tmp`);
  if (tmp.exists) tmp.delete();
  tmp.create();
  await tmp.write(content);
  tmp.moveSync(new File(dir, name), { overwrite: true });
}

export const projectRepo: ProjectRepo = {
  async list() {
    const r = root();
    if (!r.exists) return [];
    const out: ProjectSummary[] = [];
    for (const entry of r.list()) {
      if (!(entry instanceof Directory)) continue;
      const f = new File(entry, 'project.json');
      if (!f.exists) continue;
      try {
        out.push(summarize(parseProject(await f.text())));
      } catch (e) {
        console.warn(`skip corrupt project ${entry.name}`, e);
      }
    }
    return out.sort(byUpdatedDesc);
  },
  async load(id) {
    return parseProject(await new File(root(), id, 'project.json').text());
  },
  async save(p) {
    await writeAtomic(projectDir(p.id), 'project.json', serializeProject(p));
  },
  async remove(id) {
    const dir = new Directory(root(), id);
    if (dir.exists) dir.delete();
  },
  async saveSource(id, png) {
    await writeAtomic(projectDir(id), 'source.png', png);
    return 'source.png';
  },
  sourceUri(id, name) {
    return new File(root(), id, name).uri;
  },
};
