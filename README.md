# herdr-spaces-order

A [Herdr](https://herdr.dev) plugin that reorders workspaces to match the Spaces
worktree hierarchy, so the Agents panel and workspace numbers follow what the
Spaces sidebar shows.

Spaces nests a linked git worktree under its primary checkout, but Herdr's
underlying workspace order is unchanged: a worktree created later lands at the
end. With `ui.agent_panel_sort = "spaces"` the Agents panel sorts by that
underlying order, so a worktree's agent ends up far from its repository's
agents. This plugin moves each worktree group together in the real order.

## Before and after

```text
BEFORE
  Workspace order        Spaces sidebar            Agents panel
  1 project-a            project-a                 project-a
  2 project-b              `- project-a-gh-948     project-b
  3 notes                project-b                 notes
  4 project-a-gh-948     notes                     project-a-gh-948   <- far from project-a

AFTER
  Workspace order        Spaces sidebar            Agents panel
  1 project-a            project-a                 project-a
  2 project-a-gh-948       `- project-a-gh-948     project-a-gh-948   <- next to project-a
  3 project-b            project-b                 project-b
  4 notes                notes                     notes
```

The Spaces sidebar looks the same; only the workspace order (and therefore the
numbers, Agents panel, and agent cycling) changes.

## How the order works

1. Workspaces are grouped by git repository. A repository forms a group only
   while its primary checkout and at least one linked worktree are both open,
   the same rule the Spaces sidebar uses to nest them.
2. Each group is placed where its first member currently sits: primary
   checkouts first, then linked worktrees, each keeping their existing relative
   order.
3. Ungrouped workspaces keep their relative order with each other.
4. The result is applied with a single atomic `workspace.move_block`. If the
   order already matches, the plugin exits without changing anything.

It runs on server startup, on `workspace.created`, `workspace.moved`, and
`workspace.reordered`, and from the **Reorder workspaces to match Spaces**
action (`collin.spaces-order.apply`).

## Install

Requires [Bun](https://bun.sh) on `PATH` and Herdr 0.9.3 or newer.

```bash
herdr plugin install collinpeters/herdr-spaces-order
```

The Agents panel must sort by workspace order. That is the default
(`ui.agent_panel_sort = "spaces"`); if you changed it, set it back in
`config.toml`:

```toml
[ui]
agent_panel_sort = "spaces"
```

Optionally bind the action to a key:

```toml
[[keys.command]]
key = "prefix+o"
type = "plugin_action"
command = "collin.spaces-order.apply"
description = "reorder workspaces to match Spaces"
```

## Trade-offs

- Workspace numbers change when a group is pulled together, so number-based
  workspace shortcuts follow the Spaces order instead of creation order.
- Moving a linked worktree away from its group snaps it back. Spaces would draw
  it under its primary checkout anyway.

A core Herdr change that sorts only the Agents panel by the Spaces hierarchy is
proposed in [herdrdev/herdr#5054](https://github.com/herdrdev/herdr/discussions/5054).

## License

[MIT](LICENSE)
