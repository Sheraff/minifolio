# Florian Pellet

**Staff / Senior Frontend Engineer**

Paris, France | +33 7 82 77 82 82 | me@florianpellet.com | florianpellet.com | github.com/sheraff

## Summary

Software engineer with 14 years of programming experience across web, robotics, and research with the last 7 focused exclusively on the web. I focus on the technical side of web products: frontend architecture, APIs, tooling, code generation, build systems, and performance. Maintainer of TanStack Router.

## Experience

### Socket | Frontend Engineer | Aug 2026 - Present

### Matera (startup) | Staff Frontend Engineer | 2022 - Jul 2026

- Led Matera's frontend platform reset across a 1M+ LoC monorepo: introduced TypeScript into a JavaScript codebase, migrated Webpack to Vite, and redesigned imports and bundling to cut initial JS from 9MB to 2MB.
- Defined Matera's shared type-safe React Query data layer, using a proxy API with generated query keys and integrated types to unify fetching, caching, mutations, and invalidation.
- Built Matera's shared UI platform for a backend-heavy engineering org, including a 40+ component design system and in-app devtools for forms, state machines, and navigation.
- Built the tooling behind Matera's frontend transformation: rewrote CI for parallel execution, authored 20+ custom ESLint rules and migration scripts, and added code-health dashboards and CLI tools.

### Mazarine (agency) | Frontend Developer | 2019 - 2022

- Built and launched dozens of client websites across changing stacks, fixed budgets, and hard deadlines.
- Led frontend development for www.louvre.fr and stabilized projects late in delivery.

## Open Source

### TanStack Router | Maintainer

- Rewrote TanStack Router's navigation and loading pipeline to separate publication, route state, shared loader work, and framework rendering, fixing bugs across preloading, redirects, caching, pending UI, and SSR.
- Re-architected TanStack Router's reactive core into a granular signal graph across React, Solid, and Vue, cutting client-navigation benchmark times to 4.5ms in React, 8ms in Solid, and 6ms in Vue.
- Rewrote route matching from a flat route list to a segment trie, changing complexity from route-count-driven O(N) to path-depth-driven O(M) and measuring 60x faster matching on small apps and 10,000x on large apps.
- Helped drive TanStack Start SSR performance work that increased throughput 5.5x (427 to 2357 req/s) and cut p99 latency 7.1x (6558ms to 928ms) under sustained load.
- Built cross-framework performance tooling for bundle size, client navigation, SSR throughput, and flamegraph profiling, catching regressions in CI.

### tRPC | Contributor

- Designed and shipped out-of-order streaming for batched tRPC requests across client and server, including Node, Fastify, and Fetch adapters, so slow procedures no longer blocked faster responses.

## Writing

### Inside a TanStack Router Navigation

https://tanstack.com/blog/tanstack-router-navigation-lanes

### TanStack Router's New Reactive Core: A Signal Graph

https://tanstack.com/blog/tanstack-router-signal-graph

### 5x SSR Throughput: Profiling SSR Hot Paths in TanStack Start

https://tanstack.com/blog/tanstack-start-5x-ssr-throughput

### How we accidentally made route matching more performant by aiming for correctness

https://tanstack.com/blog/tanstack-router-route-matching-tree-rewrite

## Academia / Education

### PhD in Epistemology

CNRS / ENS Ulm

### Research Scholar in Robotics

MIT Media Lab

### Research Scholar in Robotics

Carnegie Mellon University

### Masters of Engineering

Ecole Nationale Superieure de Cognitique

## Technical Focus

- **Core:** TypeScript, React, API design, code generation
- **Tooling:** static analysis, custom ESLint rules, custom devtools, CLI tools, GitHub Actions, build tooling
- **Systems:** Node.js, monorepos, library internals, bundling/module resolution, profiling/benchmarking, performance
