# Scratch

## Backend

## Frontend

- Shorten the timestamp. Make it 24hr and only show the time. Does it make sense
  to just have it be since?
- I'm not sure source or level are especially helpful. The source is definitely
  taking up a ton of space. I feel like I want to use it for filtering, but I
  should probably get the filtering in place before making that assumption.
- Wire the json view up to the dark/light mode selector.
- Animate loading new rows

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
