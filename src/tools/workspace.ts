import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Tool } from "../types.js";

const REL_RE = /^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/;
const MAX_BYTES = 64 * 1024;

const ReadArgs = z.object({
  path: z.string().min(1),
});

const WriteArgs = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export function isWorkspaceDryRun(): boolean {
  const v = (process.env.AETHER_WORKSPACE_DRY_RUN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function workspaceRoot(): string {
  const override = (process.env.AETHER_WORKSPACE_ROOT ?? "").trim();
  return path.resolve(override || path.join(process.cwd(), "data", "workspace"));
}

/** Resolve a relative workspace path. Rejects traversal and absolute paths. */
export function resolveWorkspacePath(rel: string): string {
  if (!rel || !REL_RE.test(rel)) {
    throw new Error("workspace path invalid (use relative segments [a-zA-Z0-9._-])");
  }
  const root = workspaceRoot();
  const resolved = path.resolve(root, rel);
  const relToRoot = path.relative(root, resolved);
  if (!relToRoot || relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    throw new Error("workspace path escapes sandbox");
  }
  return resolved;
}

function assertSize(content: string): void {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_BYTES) {
    throw new Error(`workspace content exceeds ${MAX_BYTES} bytes`);
  }
}

export const workspaceRead: Tool = {
  name: "workspace_read",
  description:
    "Read a UTF-8 text file from the sandboxed workspace (data/workspace by default).",
  parameters: ReadArgs,
  async execute(args) {
    const parsed = ReadArgs.parse(args);
    if (isWorkspaceDryRun()) {
      return {
        dryRun: true,
        path: parsed.path,
        content: "",
        bytes: 0,
      };
    }
    const abs = resolveWorkspacePath(parsed.path);
    const content = await readFile(abs, "utf8");
    assertSize(content);
    return {
      dryRun: false,
      path: parsed.path,
      content,
      bytes: Buffer.byteLength(content, "utf8"),
    };
  },
};

/**
 * Write a UTF-8 text file into the sandboxed workspace.
 * Irreversible. AETHER_WORKSPACE_DRY_RUN=1 skips disk I/O.
 */
export const workspaceWrite: Tool = {
  name: "workspace_write",
  description:
    "Write a UTF-8 text file inside the sandboxed workspace. Irreversible. Path cannot escape the root.",
  parameters: WriteArgs,
  irreversible: true,
  async execute(args) {
    const parsed = WriteArgs.parse(args);
    assertSize(parsed.content);
    resolveWorkspacePath(parsed.path);
    if (isWorkspaceDryRun()) {
      return {
        dryRun: true,
        written: true,
        path: parsed.path,
        bytes: Buffer.byteLength(parsed.content, "utf8"),
      };
    }
    const abs = resolveWorkspacePath(parsed.path);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, parsed.content, "utf8");
    return {
      dryRun: false,
      written: true,
      path: parsed.path,
      bytes: Buffer.byteLength(parsed.content, "utf8"),
    };
  },
};
