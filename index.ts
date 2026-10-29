#!/usr/bin/env bun
// Reorder Herdr workspaces so their real order matches the Spaces sidebar
// hierarchy: linked worktrees sit directly after their primary checkout.
// With `ui.agent_panel_sort = "spaces"` the Agents panel, workspace numbers,
// and agent cycling then follow what Spaces shows.
//
// Mirrors herdr's `workspace_entries` (src/client/shell/sidebar.rs) with every
// group expanded: a repo forms a group only while both a primary and at least
// one linked worktree are open; the group is placed at its first member, with
// primaries first, then linked worktrees, each keeping its existing order.
// Ungrouped workspaces keep their positions relative to everything else, so
// the Spaces display itself never changes.
import { createConnection } from "node:net";

type Workspace = {
  workspace_id: string;
  worktree?: { repo_key: string; is_linked_worktree: boolean } | null;
};

const socketPath = process.env.HERDR_SOCKET_PATH;
if (!socketPath) {
  console.error("HERDR_SOCKET_PATH is not set; run inside Herdr");
  process.exit(1);
}

function request<T>(method: string, params: object): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  const socket = createConnection(socketPath!);
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("error", reject);
  socket.on("data", (chunk) => {
    buffer += chunk;
    const newline = buffer.indexOf("\n");
    if (newline < 0) return;
    socket.end();
    const response = JSON.parse(buffer.slice(0, newline));
    if (response.error) reject(new Error(`${method}: ${JSON.stringify(response.error)}`));
    else resolve(response.result as T);
  });
  socket.write(JSON.stringify({ id: `spaces-order:${method}`, method, params }) + "\n");
  return promise;
}

function spacesOrder(workspaces: Workspace[]): string[] {
  const members = new Map<string, Workspace[]>();
  for (const workspace of workspaces) {
    const key = workspace.worktree?.repo_key;
    if (key) members.set(key, [...(members.get(key) ?? []), workspace]);
  }
  const isLinked = (w: Workspace) => w.worktree?.is_linked_worktree === true;
  const grouped = new Set(
    [...members]
      .filter(([, group]) => group.some(isLinked) && group.some((w) => !isLinked(w)))
      .map(([key]) => key),
  );

  const order: string[] = [];
  const emitted = new Set<string>();
  for (const workspace of workspaces) {
    const key = workspace.worktree?.repo_key;
    if (!key || !grouped.has(key)) {
      order.push(workspace.workspace_id);
      continue;
    }
    if (emitted.has(key)) continue;
    emitted.add(key);
    const group = members.get(key)!;
    for (const member of group.filter((w) => !isLinked(w))) order.push(member.workspace_id);
    for (const member of group.filter(isLinked)) order.push(member.workspace_id);
  }
  return order;
}

const { workspaces } = await request<{ workspaces: Workspace[] }>("workspace.list", {});
const current = workspaces.map((w) => w.workspace_id);
const desired = spacesOrder(workspaces);
if (desired.every((id, index) => id === current[index])) process.exit(0);

// Moving every workspace as one block to the end applies the whole order atomically.
await request("workspace.move_block", { workspace_ids: desired });
console.log(`reordered: ${current.join(" ")} -> ${desired.join(" ")}`);
