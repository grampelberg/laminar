# Scratch

- Pick a name
- Get a status page that shows:
  - Make sure `display_name` is working correctly from the load generator.
- Backend -> frontend error reporting

## Bugs

-
- There's something weird about endpoints and reconnecting if you've failed in
  the past. I had the app crash on an endpoint and then, even after restarts,
  loadgen refused to connect to that endpoint. I made a new key and, voila, it
  was able to connect immediately.

## Backend

- Make it possible to configure a key for the layer in addition to the reader's
  key. Do they need to be different files? It'll probably not work to try having
  two processes with the same ID on the same host (but maybe that's fine because
  I've got Tauri using its own config directory).

  For multiple stdin forwarders to run on the same host, they likely need to be
  different endpoints. Test this, but if that's the case, rely on
  process/display_name more than the endpoint id.

- stdin forwarder
- Add version to the protocol so that I can handle breaking changes on the
  server side with clients sending different versions.

### Protocol Details

- There's a built-in peer_identity for connections. This looks to be pretty
  crypto-centric, is there any reason to use this over the assertion/observed
  identity setup that exists now?
- There's a decent amount of stats for a connection, rtt and packet data at
  least. Does this lend itself to a panel that shows what's going on? Maybe fun
  but not especially actionable or useful. A better way to approach this is "how
  can I show what's going on at a high level?"

## Frontend

- I'm not sure source or level are especially helpful. The source is definitely
  taking up a ton of space. They're both nice for filtering, but maybe they
  should go on the right instead of the left?
- Wire the json view up to the dark/light mode selector.
- Add routing that can target state like row and sidebar.
  - I don't want to link to a specific row in the infinite scroll, as that will
    be out of date quickly. Maybe there should be a "detail" view for a line?
- Opening the sidebar runs all in the click handler and takes ~200ms. That needs
  to get cleaned up. I assume it is from the JSON.parse().
- Is there a way to make this all work via the keyboard exclusively? Maybe the
  command palette can expand to have extra functionality?
- If you're filtering, there's no visual way to know whether you're actually
  receiving new logs or not. Maybe introduce a total vs filtered count?

### Testing

- There are a couple interactions that are particularly fragile right now, in
  particular:
  - I'm making some assumptions about ordering and the cursor right now, I want
    a test that validates these assumptions in a way that it _explicitly_ breaks
    if the assumption changes.
- The table is particularly performance sensitive. Resizing, initial render and
  scrolling can really consume resources. How would I go about having tests to
  at least tell me if there's some regressions here.

### Records

- Hook routes up to show/hide the sidebar.
- Work with nested objects
  - I need to update the load generator to publish nested objects
- Animate changing the sheet's values. Just opacity?
- Show renders in the table by field type (timestamp is an actual timestamp,
  level and kind as well).

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
  scrolled to? The scrollbar position does an ~okay job of suggesting how far
  you've gotten in the list.

### Fixtures

- I get a toast when I set the debug namespace and have a fixture applied. Maybe
  the setEffect is too broad?

### Error Handling

- Get a global error channel wired up so that things happening in tauri are
  visible in the UI. Maybe toast + a dialog that pops up?

### Status

- Need to have "connection status" UI that shows whether a backend is sending
  events. Maybe how many events it is sending?
- Allow garbage collection for storage.

### Settings

- Configure a remote sink to send the local client's logs to.

### Filters
