# Scratch

## CLI

- Add a config option that dumps all the metrics on shutdown.
- Get the interactions between CLI config and layer config sorted out.
- Add tests for `tap` input parsing.
- Should I handle ANSI?
- Tracing formats
  - JSON - works great
  - full, compact - ANSI isn't handled, source is process name, timestamp isn't parsed, level isn't parsed.
  - pretty - multiline fails completely

## Format

- Assume newline = new message
- Do some basic matching for timestamp and level
- Multiline
  - detect via lines starting with spaces or not (this won't work for tracing pretty output).

## TODO

- [ ] It feels like there needs to be some way to do authentication. There must
      be some kind of authn built into iroh, endpoints are keypairs after all.
      Maybe an identity layer on top of it? Verify that keypair is owned by the
      user? There's definitely two sides to this problem: clients trying to send
      you data that you don't want (griefing at least) and people trying to
      impersonate your server. In the second case, it shouldn't be possible if
      they don't have the key data.
