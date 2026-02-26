# Laminar Sink

## Development

### Prerequisites

- [git-lfs](https://git-lfs.com)
- [Tauri](https://v2.tauri.app/start/prerequisites/) - Get all the prerequisites
  installed.

### Run

To run the app:

```bash
bun tauri dev
```

To run the dev server only:

```bash
bun dev
```

If you'd like to test without `StrictMode`, set `VITE_STRICT_MODE=false`.

While it is possible to use fixtures to get data in the UI, you can also
generate some yourself:

```bash
cd ../cli && cargo run -- loadgen
```

Configure the address of your UI via the config file or env vars.

### Tauri <> Browser

We strive to make sure the UI is usable through the browser in addition to
tauri. This concretely means that when we detect that we're not running in
tauri, IPC is mocked out. If you're adding a new command or using a tauri
plugin, make sure to add it to the [dispatcher](./src/tests.tsx).

Try to limit the use of `invoke` to atoms. These can be stubbed out via fixtures
and provide different scenarios to design for in the browser. It is important
that there is a test which does _not_ rely on fixtures included for the atom.
This is used as a smoke test that the browser still works.

Note: it would be possible to do a vite + babel plugin that exports the atoms
and does a smoke test automatically. This has not been implemented yet.

### Tests

Tests are written in [vitest](https://vitest.dev) with
[playwright](https://playwright.dev).

```bash
bun run test
```

Note: `bun test` won't work because the browser doesn't get started up.

### Typegen

You can generate types from the database with:

```bash
just db-tooling
```

### Linting/Formatting

We use [Oxlint](https://oxlint.dev) for linting and formatting. There are
scripts to run it, but it is worth
[configuring your editor](https://oxc.rs/docs/guide/usage/linter/editors.html).

### Fixtures

A fixture allows you to set any (or all) of the data in the application to a
known state. You can export the current state of the UI via. the dev command
palette (`cmd-p`). This will add it to your clipboard. Paste that into a file in
the `./fixtures/myFixture.ts` directory and it will be available on reload.

Alternatively, you can author your own fixture. It needs to contain:

```ts
export default {
  countAtom: { value: 0 },
}
```

Where `countAtom` is the name of the atom you'd like to have set (or the
atom.debugLabel). You don't need to be exhaustive, just add the atoms you want.

Note: if there is an atom you want to make sure is _not_ settable, set the
`.debugPrivate` property on it. Any atoms that are not POJO must have
`.debugPrivate` set or the export will fail.

### Storybook

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

## Features

- clean: remove all the application files on startup.

## Narrative

- I can't see the logs
  - My font is too small
  - It is going by too fast
  - I want some kind of control over the formatting but can't change the logging
    framework
- My logs go away
  - If I'm outputing logs to the terminal, they're gone as soon as my session
    goes away.
- The volume is too high
  - Level is close to the best tool for filtering.
  - Using grep to filter doesn't let me look back over previous logs.
- I can't see multiple processes at once
  - I need to open multiple ssh sessions/terminals to watch things happen.
  - It is awkward to have a client and server in the same log stream.
- I hate having to wait for logs to show up in online tools.
  - Is it because my stuff is broken or their infrastructure is just slow?
- I don't want to figure out how to get logs your specific way.
  - How do I search again?
  - How do I get logs off the mobile device?
  - Where are they in your platform?
- I don't want to operate and maintain a bunch of expensive o11y infrastructure.

### What's novel?

- Logs are stored locally, no cloud infrastructure required.
- p2p means that:
  - You can send logs _from_ anywhere _to_ anywhere. There's no need to have a
    public IP address.
  - Your address stays the same, no matter where you are. If you don't change
    your `SecretKey`, the configuration for where to send logs never changes.
- No waiting, they're sent as fast as they appear.

### Important, but not novel

- Integrated with tracing, no need for an external process.
- One UI for multiple streams. You can forward everything to your local app and
  then filter it.
