# Inspector

## Development

### Prerequisites

- [git-lfs](https://git-lfs.com)
- [Tauri](https://v2.tauri.app/start/prerequisites/) - Get all the prerequisites
  installed.

### Fixtures

A fixture allows you to set any (or all) of the data in the application to a
known state. To author a fixture, add a file to the `./fixtures` directory. It
needs to contain:

```ts
export default {
  countAtom: 0,
};
```

Where `countAtom` is the name of the atom you'd like to have set (or the
atom.debugLabel). Don't include atoms that are derived, setting their values
will do nothing.

To load a fixture, make sure the `FixturePanel` component is included. That will
provide a dropdown that lets you select the fixture you'd like to load.

Note: if there is an atom you want to make sure is _not_ settable, set the
`.debugPrivate` property on it.

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
