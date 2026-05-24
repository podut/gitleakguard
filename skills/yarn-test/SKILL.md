---
name: yarn-test
description: Runs the test suite using yarn before commits and pushes. Ensures tests pass before code goes to the repository. Catches regressions, reminds to write tests for new code, and enforces test coverage thresholds.
---

# yarn-test — Test Runner Guard

Ensures tests pass before committing or pushing code.

## Before every commit or push

When the user asks to commit or push, run tests first:

```bash
# Run all tests
yarn test

# Run with coverage
yarn test --coverage

# Run specific test file
yarn test src/feature.test.js

# Run tests related to changed files only
yarn test --watchAll=false --findRelatedTests $(git diff --cached --name-only)
```

## npm equivalent

```bash
npm test
npm run test:coverage
```

## Automatic trigger

When user says: commit, push, deploy, merge, ship, release:
1. Say: "Running tests before [action]..."
2. Suggest: `yarn test`
3. If tests fail → block the action, show which tests failed
4. If tests pass → proceed with the action

## When no tests exist

If `yarn test` returns "no tests found" or the test directory is empty:
```
[WARNING] No tests found. Consider adding tests before pushing.
Suggested test file: <filename>.test.js
```

Offer to scaffold a basic test file for the code being committed.

## Coverage enforcement

```bash
# Fail if coverage drops below threshold
yarn test --coverage --coverageThreshold='{"global":{"lines":80}}'
```

## CI/CD integration

```yaml
- name: Run tests
  run: yarn test --ci --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## When tests fail

1. Show which tests failed and the error message
2. Do NOT write the commit command
3. Help diagnose the failure
4. Once fixed, re-run and confirm all pass before committing
