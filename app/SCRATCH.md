# Scratch

- Backend -> frontend error reporting
- Get the github dump working.
  - The console gets wedged, probably from printing "fetch page".
  - Rendering the table rows is consuming CPU and it speeds up a little bit by
    stopping the UI updates.
  - How is tauri handling threads? The CPU maxed out at 100% and didn't go any
    higher, makes me think multi-core isn't being used. Could that be a sqlx
    issue?
  - There should probably be a reduction in logging for receiving messages.
    maybe move to trace from debug?

- Filter labels - I'm naively taking the text and putting it into the label. For
  some filters, this works okay (source). For others, it needs a little
  translation but it still works (level). For markers, it breaks a little bit
  more. Having `Warning` as a label works for now but it is tough to know what
  it actually means. Should they be `Column: Warning`?

- Move filter de-duplication logic into the atom.
- Update tests to support the new schema
- Make retention actually do something.
- Register endpoints with a name.
- Add routing for detail view.
- UI isn't working at ~700px width right now. The sidebar is too narrow and you
  can't close it. Should probably move over to covering the whole page below
  that break point.
  - Below that, you can see the list but the icons are cut off.

## Bugs

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

  A good first step here would be to take the stats and put them into metrics.
  Blackbox can then expose these as series that are sampled via the get_series()
  tauri command to the UI.

## Frontend

- I'm not sure source or level are especially helpful. The source is definitely
  taking up a ton of space. They're both nice for filtering, but maybe they
  should go on the right instead of the left?
- Add routing that can target state like row and sidebar.
  - I don't want to link to a specific row in the infinite scroll, as that will
    be out of date quickly. Maybe there should be a "detail" view for a line?
- Is there a way to make this all work via the keyboard exclusively? Maybe the
  command palette can expand to have extra functionality?

### Testing

- There are a couple interactions that are particularly fragile right now, in
  particular:
  - I'm making some assumptions about ordering and the cursor right now, I want
    a test that validates these assumptions in a way that it _explicitly_ breaks
    if the assumption changes.
- The table is particularly performance sensitive. Resizing, initial render and
  scrolling can really consume resources. How would I go about having tests to
  at least tell me if there's some regressions here.
- "Browser" mode is fragile, any changes to the data model can result in
  breakage there. There's a smoke test for this, but it doesn't exercise all the
  UI, so it misses things. In particular, adding new tauri commands is sensitive
  as they need to be stubbed out and/or the fixtures need to be updated. Is
  there something better than what exists now?

### Detail View

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
