# Waiting in a web test

How a test in `packages/web` waits for the app to settle. A race written once gets copied,
and it passes locally for months before a slow Windows runner fails it.

## The pattern

- **Wait on what the test then asserts.** A redirect test waits for
  `router.state.location.pathname` to change, not for the destination page to render. A
  neighboring signal that tends to settle first passes until the day it settles second.
- **Wait with a cheap query, assert with the role.** `waitFor` on `querySelector`, a
  pathname or a mock's call count polls fast. `findByRole` walks the accessibility tree on
  every poll, which costs real time on a large DOM and a slow runner. Keep one synchronous
  `getByRole` after the wait where the role is the point.
- **A bare timeout is no fix.** Raising a wait moves the failure point and leaves the race.
  A wait wider than Testing Library's default goes on the one `waitFor` or `findBy*` that
  needs it, as its `timeout` option, with a comment saying why it is that size.
- **Sleep only to prove a negative.** A write, request or scroll that must *not* happen has
  no signal to wait on, so a test may sleep before asserting its absence. Say in a comment
  what is not coming and why the sleep is long enough. Anything that does happen has a
  signal; wait on it instead.

## What the fence asserts

`tests/test-waits-shape.test.ts` holds the checks a parser can make, and the allowlist of
sleeps still standing with the reason for each.

## For review

No parser sees which element a wait watches against which one the test asserts on, so
review holds these:

- A `waitFor` or `findBy*` watches the same thing the next assertion reads. Waiting for
  one element and asserting on another is the race the first rule names.
- A `findByRole` that only gates the assertions after it, on a page that renders the
  whole app, is a cheap query's job.
- A `timeout` option wider than the default names its size and its reason.
- A new allowlisted sleep proves a negative and says what is not coming.
- A sleep helper counts once where it is written, so each test calling it proves a negative
  too.
