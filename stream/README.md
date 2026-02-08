# Inspector

## Note

- `iroh::socket::remote_map::remote_state::RemoteStateActor` currently gets
  spawned without the endpoint span, resulting in those events not being
  correctly dropped. This causes increased load on the writer as it isn't
  possible to drop them.
  - `hickory_proto::*` is the primary source.
- Not currently using `MdnsAddressLookup` and instead relying on the
  `n0::preset` which is Pkarr and DNS. This is because `MdnsAddressLookup`
  relies on `acto` which is not well behaved:
  - It is orphaning itself from the root span somewhere.
  - Even though the mailbox is shutdown, it continues to try to send in a tight
    loop.
