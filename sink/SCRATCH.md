# Scratch

## Backend

- stdin forwarder

## Frontend

- I'm not sure source or level are especially helpful. The source is definitely
  taking up a ton of space. I feel like I want to use it for filtering, but I
  should probably get the filtering in place before making that assumption.
- Wire the json view up to the dark/light mode selector.
- Animate loading new rows
- Add routing that can target state like row and sidebar
- Opening the sidebar runs all in the click handler and takes ~200ms. That needs
  to get cleaned up. I assume it is from the JSON.parse().

### Testing

- There are a couple interactions that are particularly fragile right now, in
  particular:
  - The infinite scroll infrastructure.
  - The db update tooling.
  - Database queries in general.

  I'm not sure what the right way to test any of it is.

- The table is particularly performance sensitive. Resizing, initial render and
  scrolling can really consume resources. How would I go about having tests to
  at least tell me if there's some regressions here.

### Records

- Make it possible to close the sidebar. Maybe a vertical accordion?

### Table

- While it is nice for every row to be the same size, I would like for the
  message content to wrap. Should `measureElement` be used? It appears to cause
  the rendering loop when used.

  ```tsx
  measureElement: el => el.getBoundingClientRect().height,
  ```

- Can I use the virtualizer for doing infinite scroll instead of the custom one
  now?
- Even with a virtualized table, it is still taking ~75ms to render the table.
  It appears that this is all happening in `flexRender` as I don't get the
  violations when outputting raw text. Even with raw text, there are occasional
  violations. I'm not sure it is worth the effort to clean this one up.

### Fixtures

- I get a toast when I set the debug namespace and have a fixture applied. Maybe
  the setEffect is too broad?

### Error Handling

- Get a global error channel wired up so that things happening in tauri are
  visible in the UI. Maybe toast + a dialog that pops up?

### Status

- Need to have "connection status" UI that shows whether a backend is sending
  events. Maybe how many events it is sending?
- Show how much space the database is taking up. Allow garbage collection as
  well?

### Settings

- Configure a remote sink to send the local client's logs to.

### Filters

- Filter on source.
