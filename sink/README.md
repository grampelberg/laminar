# Inspector

## Development

### Prerequisites

- [git-lfs](https://git-lfs.com)
- [Tauri](https://v2.tauri.app/start/prerequisites/) - Get all the prerequisites
  installed.

### Storybook

Note: vitest is not wired up.

```bash
bun run storybook
```

When adding new shadcn components, you can also add stories for them with:

```bash
bunx shadcn add @storybook/<component>-story
```

See the [registry](https://registry.lloydrichards.dev) for what's available.

## Playground

Everything in the playground directory is meant to be for internal use.

To use the design playground, run:

```bash
bun run dev
```

You can then reach it by visiting `/design`. Note that there will be javascript
errors for most normal routes as they're going to be expecting the tauri
backend.

### Run

```bash
bun tauri dev
```

## Features

- clean: remove all the application files on startup.
