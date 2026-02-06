# Scratch

## TODO

- [ ] It feels like there needs to be some way to do authentication. There must
      be some kind of authn built into iroh, endpoints are keypairs after all.
      Maybe an identity layer on top of it? Verify that keypair is owned by the
      user? There's definitely two sides to this problem: clients trying to send
      you data that you don't want (griefing at least) and people trying to
      impersonate your server. In the second case, it shouldn't be possible if
      they don't have the key data.
