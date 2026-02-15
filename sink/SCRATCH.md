# Scratch

- Pick a name
- Get a status page that shows:
  - Connected clients.
  - Make sure `display_name` is working correctly from the load generator.
- Get a settings page that:
  - Allows configuring a remote log sink.
- Backend -> frontend error reporting
- JSON view that works
  - Need to figure out the items that are metadata vs display, eg the pkgs and
    \_added. These shouldn't be included in the view but maybe the table
    _should_ be joined so that it shows up correctly in the UI?
- Some kind of testing framework

## Bugs

- From disconnect to receiving the event appears to be about ~30s. Is there a
  way to make that faster?
- There's something weird about endpoints and reconnecting if you've failed in
  the past. I had the app crash on an endpoint and then, even after restarts,
  loadgen refused to connect to that endpoint. I made a new key and, voila, it
  was able to connect immediately.
- The "top" definition uses overscan right now. That means that even if you've
  scrolled down from the top, it'll still get live updates which is pretty
  annoying.

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

- Add heartbeats on the server side so that we can have a reliable way to show
  connection status even though disconnects can be missed.
- Need to have "connection status" UI that shows whether a backend is sending
  events. Maybe how many events it is sending?
- Allow garbage collection for storage.
- Implement a visual "last seen" for each client.

### Settings

- Configure a remote sink to send the local client's logs to.

### Filters
