# Laminar

View and analyze logs from your terminal, services and applications. Source them
locally or remotely, all without infrastructure. Forward your logs via `tap` by
piping stdin to it. View those with the `sink` application running on your
machine.

Viewing logs in terminals is hard. I always forget where I'm running and
inevitably end up restarting what I'm working on to pipe things through `grep`.
There are a lot of log viewing tools out there, but they all tend to be heavy
and require infrastructure I'm just too lazy to set up. Laminar provides a great
log viewing and filtering experience without any of the overhead.

This means that it can consume stdin, via pipes (the `tap` command) and forward
that stream to a viewer running on your system. You can, alternatively,
integrate with your language's logging provider such as Rust's `tracing` and
have the messages emitted directly from the process. In the log viewer, the
`sink`, you have a dedicated viewer with filtering, history and extra metadata.
Instead of having to scroll through your terminal as everything goes off the
screen, you can have a persistent view that lets you hunt for specific events
and inspect them in detail.

To make forwarding reliable, we implemented p2p connectivity. Your address is
derived from a keypair and follows you everywhere. Whether you're at home behind
a NAT or at the office, you'll always be able to receive the messages without
needing to change the address or configuration. The result is that for most
things, you can just set the `tap` command up and let it run. It'll forward logs
when the sink is active and quietly drop them when it isn't.

One way to use this would be pair debugging sessions. Instead of having to ask
someoen what's on their screen or to copy/paste logs through chat to you, you
can have them `tap` the logs and send them to your sink in real time. That way,
you see what they see and can ask questions about what's going on immediately.

In the end, you end up with your own "shadow" observability stack. There's no
need to rely on third-party services, whether that's a CI runner or a cloud
service provider. When you need to know what's going on, you can `tap` it and
get exactly what you need, without any extra configuration or waiting.

## Structure

- [`cli`](./cli) - Tools for forwarding logs.
- [`app`](./app) - The log viewer application.
- [`core`](./core) - Core functionality, including the protocol, client and
  server.
- [`testing`](./testing) - Common testing helpers.
