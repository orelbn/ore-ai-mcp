---
name: typescript-backend-organization
description: "Organize or refactor modern TypeScript backends with clear module boundaries, readable files, practical reuse, high cohesion, low coupling, and explicit public exports. Use when shaping backend folder structure, splitting responsibilities inside modules, deciding what belongs in `modules/`, `services/`, or `lib/`, or cleaning up layer-based sprawl."
---

# TypeScript Backend Organization

Organize by module first.

## Apply These Rules

- Group code by module or domain, not global technical layer.
- Keep files and folders small, focused, and easy to scan.
- Separate transport, validation, business logic, and data access.
- Prefer folder context over repetitive file names.
- Reuse code when it keeps the codebase DRY without reducing cohesion or increasing coupling.
- Let a concern start as a file and become a folder when complexity justifies it.
- Put third-party integrations under `services/`; keep service setup, adapters, and service-specific tests there.

Example: keep Stripe-specific setup and test helpers in `services/stripe/`, while each module owns how it uses Stripe.

## Use This Structure

```txt
src/
  modules/
    <module>/
      route.ts
      handler.ts
      schema.ts
      logic/
      repo/
      types.ts
      errors.ts
      index.ts
  services/
    <service>/
      files...
  lib/
    db/
    security/
    auth/
    http/
    env/
  config/

tests/
  integration/
  e2e/
```

## Assign Responsibilities Clearly

- `route.ts`: keep wiring only.
- `handler.ts`: keep a thin transport layer.
- `schema.ts` or `schema/`: validate and parse inputs.
- `logic/`: hold business logic.
- `repo.ts` or `repo/`: handle persistence only.
- `types.ts` or `types/`: define module-local types.
- `errors.ts` or `errors/`: define explicit failures.
- `index.ts`: expose the module's public API only.

Treat `index.ts` as the only cross-module entrypoint by default. Keep `schema/`, `logic/`, `repo/`, `types/`, and `errors/` internal unless the module intentionally re-exports something stable.

## Scale By Splitting Folders

When a concern grows, split it into a folder.

```txt
modules/users/
  route.ts
  handler.ts
  schema/
    create-user.ts
    update-user.ts
    shared.ts
  logic/
    create-user.ts
    update-user.ts
    delete-user.ts
  repo/
    create-user.ts
    find-user.ts
  types/
    api.ts
    model.ts
  errors/
    user-not-found.ts
  index.ts
```

Keep each file responsible for one main job.

## Reuse Carefully

Extract shared code when it is:

- reused
- stable
- truly cross-module
- easier to understand shared than duplicated

Keep module-specific helpers inside the module.

Use `lib/` for shared primitives and infrastructure. Use `modules/` for owned workflows and application behavior.

## Export A Real Public API

Use a module-level `index.ts` to define the public API.

Keep the export interface as small as possible. Export the minimum surface other modules need, and prefer promoting fewer stable entrypoints over exposing internal building blocks.

Export only what other modules should depend on:

- public types
- public logic
- route or module registration
- stable constants

Do not export private helpers or internal implementation details.

Default to imports from another module's `index.ts`, not from its internal folders. If another module needs a symbol often enough to justify direct use, promote it into the public API deliberately instead of reaching inward.

## Optimize For Readability

- one file, one main job
- one folder, one clear responsibility
- put the main export near the top
- keep helpers below
- prefer explicit names over clever abstractions
- comment non-obvious reasoning only
- avoid giant barrel export chains
- avoid top-level global folders like `controllers/`, `services/`, or `repositories/`

## Place Tests Intentionally

- Keep integration and e2e tests that involve more than one module in `tests/`.
- Mirror source structure in tests when it helps navigation.
- Keep unit tests colocated with functionality and use `.test.ts`.
- Use `.spec.ts` for e2e tests.

## Avoid These Anti-Patterns

- global layer folders for the whole app
- giant `service.ts`
- dumping unrelated code into `utils/`
- mixing validation, business logic, and persistence
- abstracting before the code earns it
