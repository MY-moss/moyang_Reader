# Development dependency risk acceptance

Moyang Reader ships with zero known production dependency vulnerabilities. The full dependency tree currently reports vulnerabilities only through the WebdriverIO/Tauri desktop-test toolchain.

- Owner: `@MY-moss`
- Tracking issue: [#534](https://github.com/MY-moss/moyang_Reader/issues/534)
- Review deadline: **2026-10-19**
- Scope: development and CI dependencies only; none of these packages are bundled into the Windows application.

The exact advisory list and per-advisory exploitability rationale live in [`scripts/dev-audit-exceptions.json`](../../scripts/dev-audit-exceptions.json). CI validates that:

1. production dependencies still have zero reported vulnerabilities;
2. no critical advisory is accepted;
3. every active development advisory has an explicit rationale;
4. a new or resolved advisory fails the check until the exception set is reviewed;
5. the exception expires on the date above.

Current mitigations are a committed lockfile, installs from the public npm registry, checked-in WebdriverIO configuration, no user-controlled archives/YAML/config objects in the test runner, and no use of the vulnerable glob `--cmd` path. The test chain is kept on its latest compatible stable release while upstream packages remove the affected transitive versions.

Do not use `npm audit fix --force`; it currently proposes incompatible downgrades of the Tauri test service and does not preserve the supported desktop-test stack.
