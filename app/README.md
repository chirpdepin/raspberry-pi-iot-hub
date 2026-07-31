# Chirp Hub

The desktop app that sets up cameras, LoRaWAN and Zigbee/Thread on a Chirp IoT Hub **without a terminal**.

Runs on the Raspberry Pi itself (with a screen attached) and on Windows, macOS and Linux, managing that
machine's own Docker. On a desktop without a LoRaWAN radio the app says so and explains what hardware is
needed, rather than hiding the feature.

**Read [electron.md](electron.md) before changing anything here.** It is the design record: architecture,
the four contracts, every screen and flow with the real API fields, and the reasons behind the decisions
that look arbitrary.

## The four contracts

Every piece of work restates the part of each contract it must satisfy — stated once, they stop
influencing the work several phases later.

1. **SOLID** — one use case per operation, extension by registry not `switch`, narrow ports declared by
   the consuming use case. Every use case unit-testable with fakes: no Docker, no camera, no network.
2. **The non-technical user** — no jargon, no raw errors, nothing asked that can be detected, one primary
   action per screen, visible proof it worked, never stuck.
3. **Portability** — no hardcoded system paths, all privilege behind a port, all container work behind a
   port, and a UI that works fullscreen with no window chrome. Keeps an Ubuntu Core move cheap.
4. **Single source of truth** — colors and spacing from the ui-kit theme, text from `locales/`, constants
   from `config/`, paths from `PathsPort`. Nothing hardcoded, ever.

## Enforcement

```bash
npm run check:boundaries            # fails CI on any contract violation
npm run check:boundaries:self-test  # proves the checker itself works
```

The self-test plants a violation of every rule and asserts each is caught, then asserts a clean tree
passes. A checker nobody has watched fail is a checker nobody should trust.

## Status

See [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md).
