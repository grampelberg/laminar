# Scratch

## Backend

- stdin forwarder

## Frontend

- I'm not sure source or level are especially helpful. The source is definitely
  taking up a ton of space. They're both nice for filtering, but maybe they
  should go on the right instead of the left?
- Wire the json view up to the dark/light mode selector.
- Add routing that can target state like row and sidebar
- Opening the sidebar runs all in the click handler and takes ~200ms. That needs
  to get cleaned up. I assume it is from the JSON.parse().

### Bugs

- Applying a filter and then removing it causes some rows to be "new", mostly
  based on whether they were in the data previously or not. Is there a more
  reliable way to mark "newly received to the database" rows? Maybe just use the
  damn database timestamp to manage the animation? Is that insane? It is insane.

### Testing

- There are a couple interactions that are particularly fragile right now, in
  particular:
  - The infinite scroll infrastructure.
  - The db update tooling.
  - Database queries in general.
  - I'm making some assumptions about ordering and the cursor right now, I want
    a test that validates these assumptions in a way that it _explicitly_ breaks
    if the assumption changes.

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

- Even with a virtualized table, it is still taking ~75ms to render the table.
  It appears that this is all happening in `flexRender` as I don't get the
  violations when outputting raw text. Even with raw text, there are occasional
  violations. I'm not sure it is worth the effort to clean this one up.

  Note: it has up to ~110ms or so now. The cell renders are doing more work. I'm
  not sure you can tell that there's a delay though given all the animations.

- Does it make sense to add a way to know where in the total rows you are
  scrolled to?

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
