app recipe:
    cd app && just {{ recipe }}

cli cmd:
    cd cli && cargo run -- {{ cmd }}

check:
    cargo clippy
    cargo check
    cd app && just check
