# laminar-cli

CLI tools for sending, receiving, and generating Laminar stream data.

## Format

- Assume newline = new message
- Do some basic matching for timestamp and level
- Multiline
  - detect via lines starting with spaces or not (this won't work for tracing
    pretty output).

### Tracing

- JSON - works great
- full, compact - ANSI isn't handled, source is process name, timestamp isn't
  parsed, level isn't parsed.
- pretty - multiline fails completely
