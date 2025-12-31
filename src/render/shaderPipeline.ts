export type TextureDirective = { name: string; url: string };
export type BufferDirective = { name: string; file: string };
export type PrevDirective = { name: string };

export type ExpandedShader = {
  code: string;
  textures: TextureDirective[];
  buffers: BufferDirective[];
  prevs: PrevDirective[];
};

export type PassDesc = {
  file: string;
  expanded: ExpandedShader;
};

export type PipelineDesc = {
  entry: string;
  passesInOrder: PassDesc[]; // topo order; entry is last
};

type DirectiveParse = {
  keptPreambleLines: string[]; // non-directive comments/blanks at top
  includes: string[];
  textures: TextureDirective[];
  buffers: BufferDirective[];
  prevs: PrevDirective[];
  rest: string; // source without directive-lines (but with kept preamble)
};

function normalizeName(s: string) {
  return s.trim();
}

function parseCommaPair(arg: string): [string, string] {
  const idx = arg.indexOf(",");
  if (idx === -1) throw new Error(`Expected "name, value", got: ${arg}`);
  const a = arg.slice(0, idx).trim();
  const b = arg.slice(idx + 1).trim();
  if (!a || !b)
    throw new Error(`Expected non-empty "name, value", got: ${arg}`);
  return [a, b];
}

function parseNameOnly(arg: string): string {
  // Allow either "@prev name" or "@prev name, ..." (ignore trailing comma payload)
  const trimmed = arg.trim();
  if (!trimmed) throw new Error(`@prev requires varName`);
  const comma = trimmed.indexOf(",");
  const name = (comma === -1 ? trimmed : trimmed.slice(0, comma)).trim();
  if (!name) throw new Error(`@prev requires varName`);
  return normalizeName(name);
}

/**
 * Scans only the "top block" (empty lines + //comments).
 * Removes directive lines from code, keeps regular comments.
 */
function parseLeadingDirectives(src: string): DirectiveParse {
  const lines = src.split(/\r?\n/);
  const kept: string[] = [];
  const includes: string[] = [];
  const textures: TextureDirective[] = [];
  const buffers: BufferDirective[] = [];
  const prevs: PrevDirective[] = [];

  let i = 0;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();

    if (t === "") {
      kept.push(raw);
      continue;
    }

    if (!t.startsWith("//")) break;

    const body = t.slice(2).trim();

    // allow normal comments in preamble
    if (!body.startsWith("@")) {
      kept.push(raw);
      continue;
    }

    if (body.startsWith("@include")) {
      const arg = body.slice("@include".length).trim();
      if (!arg) throw new Error(`@include requires fileName`);
      includes.push(arg);
      continue;
    }

    if (body.startsWith("@texture")) {
      const arg = body.slice("@texture".length).trim();
      const [name, url] = parseCommaPair(arg);
      textures.push({ name: normalizeName(name), url });
      continue;
    }

    if (body.startsWith("@buffer")) {
      const arg = body.slice("@buffer".length).trim();
      const [name, file] = parseCommaPair(arg);
      buffers.push({ name: normalizeName(name), file });
      continue;
    }

    if (body.startsWith("@prev")) {
      const arg = body.slice("@prev".length).trim();
      const name = parseNameOnly(arg);
      prevs.push({ name });
      continue;
    }

    // unknown directive: keep comment in code
    kept.push(raw);
  }

  const rest = kept.concat(lines.slice(i)).join("\n");
  return { keptPreambleLines: kept, includes, textures, buffers, prevs, rest };
}

function mergeUniqueByName<T extends { name: string }>(
  into: Map<string, T>,
  items: T[],
  onConflict: (name: string, a: T, b: T) => never
) {
  for (const it of items) {
    const prev = into.get(it.name);
    if (!prev) {
      into.set(it.name, it);
      continue;
    }
    // conflict resolution is handled by caller
    if (JSON.stringify(prev) !== JSON.stringify(it)) {
      onConflict(it.name, prev, it);
    }
  }
}

export class ShaderPipelineBuilder {
  private readonly readFile: (path: string) => string | null;

  constructor(readFile: (path: string) => string | null) {
    this.readFile = readFile;
  }

  build(entryFile: string): PipelineDesc {
    const nodeMemo = new Map<string, ExpandedShader>();
    const visitingPass = new Set<string>();

    const loadExpandedForPass = (file: string): ExpandedShader => {
      const memo = nodeMemo.get(file);
      if (memo) return memo;

      if (visitingPass.has(file)) {
        throw new Error(`Cyclic dependency (buffer/include) on file: ${file}`);
      }
      visitingPass.add(file);

      const src = this.readFile(file);
      if (src == null) throw new Error(`File not found: ${file}`);

      parseLeadingDirectives(src); // keep validation behavior consistent

      // expand includes (recursive), but with a per-pass include guard
      const includeGuard = new Set<string>();
      const expandIncludes = (f: string, chain: string[]): ExpandedShader => {
        const src2 = this.readFile(f);
        if (src2 == null) throw new Error(`File not found: ${f}`);

        const p = parseLeadingDirectives(src2);

        const texturesMap = new Map<string, TextureDirective>();
        const buffersMap = new Map<string, BufferDirective>();
        const prevsMap = new Map<string, PrevDirective>();

        // merge directives from this file
        mergeUniqueByName(texturesMap, p.textures, (name, a, b) => {
          throw new Error(
            `Conflict @texture "${name}" in ${f}: "${a.url}" vs "${b.url}"`
          );
        });
        mergeUniqueByName(buffersMap, p.buffers, (name, a, b) => {
          throw new Error(
            `Conflict @buffer "${name}" in ${f}: "${a.file}" vs "${b.file}"`
          );
        });
        mergeUniqueByName(prevsMap, p.prevs, (name) => {
          throw new Error(`Conflict @prev "${name}" in ${f}`);
        });

        const includedCodes: string[] = [];
        for (const inc of p.includes) {
          if (includeGuard.has(inc)) continue;
          if (chain.includes(inc)) {
            throw new Error(`Cyclic @include: ${chain.join(" -> ")} -> ${inc}`);
          }
          includeGuard.add(inc);

          const ex = expandIncludes(inc, chain.concat([inc]));
          includedCodes.push(ex.code);

          mergeUniqueByName(texturesMap, ex.textures, (name, a, b) => {
            throw new Error(
              `Conflict @texture "${name}" via include: "${a.url}" vs "${b.url}"`
            );
          });
          mergeUniqueByName(buffersMap, ex.buffers, (name, a, b) => {
            throw new Error(
              `Conflict @buffer "${name}" via include: "${a.file}" vs "${b.file}"`
            );
          });
          mergeUniqueByName(prevsMap, ex.prevs, (name) => {
            throw new Error(`Conflict @prev "${name}" via include`);
          });
        }

        const code = [...includedCodes, p.rest].filter(Boolean).join("\n");
        return {
          code,
          textures: [...texturesMap.values()],
          buffers: [...buffersMap.values()],
          prevs: [...prevsMap.values()],
        };
      };

      // IMPORTANT:
      // For pass files, we recursively expand includes, but @buffer remains as a dependency,
      // not inlined into the code.
      const expanded = expandIncludes(file, [file]);

      // memoize & unmark
      nodeMemo.set(file, expanded);
      visitingPass.delete(file);
      return expanded;
    };

    // build dependency graph over passes (@buffer edges)
    const graphAdj = new Map<string, Set<string>>(); // file -> deps
    const allFiles = new Set<string>();

    const visitGraph = (file: string) => {
      allFiles.add(file);
      const expanded = loadExpandedForPass(file);

      const deps = graphAdj.get(file) ?? new Set<string>();
      graphAdj.set(file, deps);

      for (const b of expanded.buffers) {
        deps.add(b.file);
        visitGraph(b.file);
      }
    };

    visitGraph(entryFile);

    // topo sort (deps first)
    const temp = new Set<string>();
    const perm = new Set<string>();
    const order: string[] = [];

    const dfs = (f: string) => {
      if (perm.has(f)) return;
      if (temp.has(f)) throw new Error(`Cyclic @buffer: ${f}`);
      temp.add(f);
      for (const dep of graphAdj.get(f) ?? []) dfs(dep);
      temp.delete(f);
      perm.add(f);
      order.push(f);
    };

    dfs(entryFile);

    const passesInOrder: PassDesc[] = order.map((f) => ({
      file: f,
      expanded: loadExpandedForPass(f),
    }));

    return { entry: entryFile, passesInOrder };
  }
}
