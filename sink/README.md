# Inspector

## Development

### Prerequisites

- [git-lfs](https://git-lfs.com)
- [Tauri](https://v2.tauri.app/start/prerequisites/) - Get all the prerequisites
  installed.

### Fixtures

A fixture allows you to set any (or all) of the data in the application to a
known state. You can export the current state of the UI via. the dev command
palette (`cmd-p`). This will add it to your clipboard. Paste that into a file in
the `./fixtures/myFixture.ts` directory and it will be available on reload.

Alternatively, you can author your own fixture. It needs to contain:

```ts
export default {
  countAtom: { value: 0 },
};
```

Where `countAtom` is the name of the atom you'd like to have set (or the
atom.debugLabel). You don't need to be exhaustive, just add the atoms you want.
Additionally, don't include atoms that are derived, setting their values will do
nothing.

You can also have fixtures that run functions. For example:

```ts
import { countAtom } from "./stuff.tsx";

export default {
  derivedAtom = { read: (get) => get(countAtom) + 100 },
};
```

This has the same parameters as atoms (`{ read: Getter, write: Setter }`).

To load a fixture, open the dev command palette (`cmd-p`). You'll be able to
select from any of the available fixtures.

Note: if there is an atom you want to make sure is _not_ settable, set the
`.debugPrivate` property on it.

### Storybook

Note: vitest is not wired up.

```bash
bun run storybook
```

When adding new shadcn components, you can also add stories for them with:

```bash
VITE_MOCK=true bunx shadcn add @storybook/<component>-story
```

See the [registry](https://registry.lloydrichards.dev) for what's available.

## Playground

Everything in the playground directory is meant to be for internal use.

To use the design playground, run:

```bash
VITE_MOCK=true bun run dev
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
