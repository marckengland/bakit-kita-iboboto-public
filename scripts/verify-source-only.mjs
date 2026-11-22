import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const inventory = JSON.parse(
  readFileSync(path.join(root, "publication/original-tests.json"), "utf8")
);
const populated = process.argv.includes("--populated-release")
  ? JSON.parse(readFileSync(path.join(root, "publication/populated-release.json"), "utf8"))
  : null;
if (populated) {
  assert.equal(
    populated.approvedBatchArchiveSha256,
    "b8fbb6053bce3aa2a284d612fab490b85663abc52bb4fdfb7fda549075dc1faa"
  );
  assert.equal(populated.publicationAuthorized, false);
  assert.equal(populated.existingDatabaseAuthorized, false);
  assert.equal(Object.keys(populated.existingTestFiles).length, 98);
  for (const [file, digest] of Object.entries(populated.existingTestFiles)) {
    assert.equal(hash(file), digest, `Changed inherited test: ${file}`);
  }
}
const dependencyRevision = populated?.dependencyRevision;
if (dependencyRevision) {
  assert.equal(dependencyRevision.advisory, "GHSA-7589-6fvf-x4pw");
  assert.deepEqual(dependencyRevision.override, {
    parent: "@prisma/config@7.10.1",
    dependency: "effect",
    version: "3.22.1",
  });
  assert.equal(dependencyRevision.previousEffectVersion, "3.20.0");
  assert.deepEqual(dependencyRevision.changedPackageLocations, ["node_modules/effect"]);
}
function files(directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(directory, entry.name);
    assert.ok(
      !lstatSync(path.join(root, relative)).isSymbolicLink(),
      `Source symlink: ${relative}`
    );
    return entry.isDirectory() ? files(relative) : [relative];
  });
}
function hash(relative) {
  return createHash("sha256")
    .update(readFileSync(path.join(root, relative)))
    .digest("hex");
}
if (!process.argv.includes("--allow-git-checkout")) {
  assert.ok(
    !existsSync(path.join(root, ".git")),
    "Preparation folder must have no Git metadata; CI can explicitly allow its own checkout"
  );
}
assert.ok(
  existsSync(path.join(root, "scripts/regression/prisma-client.ts")),
  "Missing isolated regression database boundary"
);
assert.ok(!existsSync(path.join(root, "scripts/data")), "Research extracts must be absent");
assert.deepEqual(
  files("src")
    .filter((file) => /\.(?:test|spec)\.ts$/.test(file))
    .sort(),
  [
    ...Object.keys(inventory.testFiles),
    ...Object.keys(inventory.addedTestFiles),
    ...Object.keys(populated?.addedTestFiles ?? {}),
  ].sort()
);
assert.deepEqual(Object.keys(inventory.addedTestFiles), [
  "src/app/api/contact/route.test.ts",
  "src/app/api/chatbot/route.availability.test.ts",
  "src/app/api/politicians/[id]/route.test.ts",
  "src/services/politician-name-lookup.test.ts",
  "src/test/chat-dock.test.ts",
  "src/test/comparison-entry.test.ts",
  "src/test/homepage-evidence.test.ts",
  "src/test/language-welcome.test.ts",
  "src/test/profile-data-states.test.ts",
  "src/test/research-journey.test.ts",
  "src/lib/comparison-selection.test.ts",
  "src/services/comparison-data-states.test.ts",
  "src/services/reviewed-chat.service.test.ts",
  "src/app/api/chatbot/records/route.test.ts",
  "src/test/reviewed-chat-answer.test.ts",
]);
const approvedFixtureChanges = inventory.approvedFixtureChanges;
assert.deepEqual(Object.keys(approvedFixtureChanges), ["src/test/reviewed-controversies.test.ts"]);
for (const file of Object.keys(approvedFixtureChanges)) {
  assert.ok(Object.hasOwn(inventory.testFiles, file), `Unknown original test: ${file}`);
}
const pinnedTests = { ...inventory.testFiles, ...inventory.addedTestFiles };
const approvedFormattingChanges = inventory.approvedFormattingChanges;
const syntheticRevisions = inventory.approvedSyntheticRevisions;
assert.deepEqual(Object.keys(syntheticRevisions.testFiles), [
  "src/test/reviewed-controversies.test.ts",
]);
assert.deepEqual(Object.keys(syntheticRevisions.fixtureHelpers), [
  "scripts/lib/reviewed-controversies.ts",
]);
assert.deepEqual(Object.keys(syntheticRevisions.mainSyntax), [
  "scripts/maintenance/fix-bbm-controversy.ts",
]);
assert.equal(Object.keys(approvedFormattingChanges).length, 35);
for (const [file, revision] of Object.entries(approvedFormattingChanges)) {
  assert.ok(Object.hasOwn(pinnedTests, file), `Unknown formatted test: ${file}`);
  assert.equal(
    revision.previousSha256,
    approvedFixtureChanges[file]?.sha256 ?? pinnedTests[file],
    `Formatting baseline does not match approved test: ${file}`
  );
  assert.match(revision.syntaxSha256, /^[a-f0-9]{64}$/, `Missing syntax review: ${file}`);
}
for (const [file, digest] of Object.entries(populated?.addedTestFiles ?? {})) {
  assert.ok(!Object.hasOwn(pinnedTests, file), `New test replaces inherited test: ${file}`);
  assert.equal(hash(file), digest, `Changed integration test: ${file}`);
}
for (const [file, originalDigest] of Object.entries(pinnedTests)) {
  const precedingDigest =
    approvedFormattingChanges[file]?.sha256 ??
    approvedFixtureChanges[file]?.sha256 ??
    originalDigest;
  const revision = syntheticRevisions.testFiles[file];
  if (revision) {
    assert.equal(revision.previousSha256, precedingDigest, `Synthetic test baseline: ${file}`);
    assert.match(revision.syntaxSha256, /^[a-f0-9]{64}$/, `Missing syntax review: ${file}`);
    assert.equal(revision.assertionCalls, 40, `Changed assertion inventory: ${file}`);
  }
  const digest = revision?.sha256 ?? precedingDigest;
  assert.equal(hash(file), digest, `Unapproved change to test: ${file}`);
}
for (const [file, digest] of Object.entries({
  ...inventory.unchangedConfiguration,
  ...inventory.retainedFixtureHelper,
})) {
  if (populated && file === "package.json") {
    const revision = populated.packageRevision;
    assert.equal(revision.previousSha256, digest, "Package revision baseline differs");
    const current = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    if (dependencyRevision) {
      assert.equal(
        dependencyRevision.packageJson.previousSha256,
        revision.sha256,
        "Dependency package baseline differs"
      );
      assert.equal(
        hash(file),
        dependencyRevision.packageJson.sha256,
        "Unreviewed dependency revision"
      );
      assert.deepEqual(current.overrides["@prisma/config@7.10.1"], { effect: "3.22.1" });
      delete current.overrides["@prisma/config@7.10.1"];
    } else {
      assert.equal(hash(file), revision.sha256, "Unreviewed package revision");
    }
    for (const [name, value] of Object.entries(revision.scriptsAdded)) {
      assert.equal(current.scripts[name], value, `Changed approved import script: ${name}`);
      delete current.scripts[name];
    }
    function canonical(value) {
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])])
        );
      return value;
    }
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(canonical(current)))
        .digest("hex"),
      revision.unchangedPackageCanonicalSha256,
      "Dependency declarations or original package commands changed"
    );
    continue;
  }
  if (dependencyRevision && file === "package-lock.json") {
    assert.equal(
      dependencyRevision.packageLock.previousSha256,
      digest,
      "Dependency lock baseline differs"
    );
    assert.equal(
      dependencyRevision.packageLock.sha256,
      "26d5340fa5e155c1f6d7f54542f0a21f7cc683cabaa91a8307b675794fd7f897",
      "Approved Effect lock hash differs"
    );
    assert.equal(hash(file), dependencyRevision.packageLock.sha256, "Unreviewed dependency lock");
    const lock = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    assert.equal(lock.packages["node_modules/@prisma/config"].version, "7.10.1");
    assert.equal(lock.packages["node_modules/@prisma/config"].dependencies.effect, "3.20.0");
    assert.equal(lock.packages["node_modules/effect"].version, "3.22.1");
    continue;
  }
  const revision = syntheticRevisions.fixtureHelpers[file];
  if (revision) {
    assert.equal(revision.previousSha256, digest, `Synthetic helper baseline: ${file}`);
  }
  assert.equal(
    hash(file),
    revision?.sha256 ?? digest,
    `Changed original test or dependency configuration: ${file}`
  );
}
for (const name of readdirSync(root)) {
  assert.ok(
    name === ".env.example" || !/^\.env(?:\.|$)/.test(name),
    "Private environment file in publication copy"
  );
}
const fixtureCommands = [
  "scripts/maintenance/add-controversies.ts",
  "scripts/maintenance/add-controversies-batch2.ts",
  "scripts/maintenance/fix-bbm-controversy.ts",
  "scripts/maintenance/fix-reviewed-controversies.ts",
];
for (const file of fixtureCommands) {
  for (const url of ["", "postgresql://fixture@127.0.0.1:1/unused_fixture"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", file], {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: url,
        DOTENV_CONFIG_PATH: "/dev/null",
        DATA_PIPELINE_ENABLED: "false",
        AI_RESEARCH_ENABLED: "false",
      },
      encoding: "utf8",
      timeout: 15000,
    });
    assert.equal(result.status, 1, `Fixture command must refuse standalone execution: ${file}`);
    assert.match(
      result.stderr,
      /test-only regression fixture/i,
      `Fixture did not use its isolated boundary: ${file}`
    );
  }
}
for (const file of [
  "scripts/update-politician-data.ts",
  "scripts/update-family-relationships.ts",
  "scripts/import-senate-history.ts",
  "scripts/maintenance/fix-source-urls.ts",
  "scripts/maintenance/backfill-family-sources.ts",
  "scripts/maintenance/backfill-controversy-sources.ts",
  "scripts/maintenance/fix-controversy-accuracy.ts",
]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", file], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: "", DOTENV_CONFIG_PATH: "/dev/null" },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 1, `Withheld command must refuse execution: ${file}`);
  assert.match(result.stderr, /review and approval/i, `Unexpected held-command boundary: ${file}`);
}
function mainSyntax(_source, main) {
  function structure(node) {
    const children = [];
    ts.forEachChild(node, (child) => {
      children.push(structure(child));
    });
    return [
      node.kind,
      !ts.isSourceFile(node) && typeof node.text === "string" ? node.text : null,
      typeof node.operator === "number" ? node.operator : null,
      node.kind === ts.SyntaxKind.VariableDeclarationList
        ? node.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)
        : null,
      children,
    ];
  }
  return JSON.stringify(structure(main));
}
for (const [file, digest] of Object.entries(inventory.retainedMainSyntax)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  const main = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "main"
  );
  assert.ok(main, `Missing retained main function: ${file}`);
  const normalized = mainSyntax(source, main);
  const revision = syntheticRevisions.mainSyntax[file];
  if (revision) {
    assert.equal(revision.previousSha256, digest, `Synthetic repair baseline: ${file}`);
  }
  assert.equal(
    createHash("sha256").update(normalized).digest("hex"),
    revision?.sha256 ?? digest,
    `Changed retained seed or repair logic: ${file}`
  );
}
for (const [file, revision] of Object.entries(syntheticRevisions.testFiles)) {
  const source = ts.createSourceFile(
    file,
    readFileSync(path.join(root, file), "utf8"),
    ts.ScriptTarget.Latest,
    true
  );
  assert.equal(
    createHash("sha256").update(mainSyntax(source, source)).digest("hex"),
    revision.syntaxSha256,
    `Changed approved synthetic test syntax: ${file}`
  );
  let assertionCalls = 0;
  function countAssertions(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "expect"
    ) {
      assertionCalls++;
    }
    ts.forEachChild(node, countAssertions);
  }
  countAssertions(source);
  assert.equal(assertionCalls, revision.assertionCalls, `Changed assertion count: ${file}`);
}
const allowedScripts = new Set([
  "scripts/README.md",
  "scripts/clean.mjs",
  "scripts/generate-pwa-icons.ts",
  "scripts/import-politicians.ts",
  "scripts/import-senate-history.ts",
  "scripts/lib/prisma-client.ts",
  "scripts/lib/reviewed-controversies.ts",
  "scripts/lib/stealth-browser.ts",
  "scripts/maintenance/README.md",
  "scripts/maintenance/add-controversies.ts",
  "scripts/maintenance/add-controversies-batch2.ts",
  "scripts/maintenance/backfill-controversy-sources.ts",
  "scripts/maintenance/backfill-family-sources.ts",
  "scripts/maintenance/fix-bbm-controversy.ts",
  "scripts/maintenance/fix-controversy-accuracy.ts",
  "scripts/maintenance/fix-reviewed-controversies.ts",
  "scripts/maintenance/fix-source-urls.ts",
  "scripts/regression/README.md",
  "scripts/regression/prisma-client.ts",
  "scripts/setup-elasticsearch.ts",
  "scripts/start-dev.ps1",
  "scripts/update-family-relationships.ts",
  "scripts/update-politician-data.ts",
  "scripts/verify-case-review.ts",
  "scripts/verify-source-only.mjs",
]);
for (const file of populated?.addedScripts ?? []) allowedScripts.add(file);
assert.deepEqual(
  files("scripts").sort(),
  [...allowedScripts].sort(),
  "Unexpected script or research payload"
);
for (const file of files("src")) {
  if (file.startsWith("src/test/") || /\.(?:test|spec)\.ts$/.test(file)) continue;
  assert.ok(
    !/scripts\/(?:regression|maintenance|lib\/reviewed-controversies)/.test(
      readFileSync(path.join(root, file), "utf8")
    ),
    `Production source refers to regression research: ${file}`
  );
}
function configuredEndpoint(file, variable, value) {
  const observed = [];
  class FakeClient {
    constructor(options) {
      observed.push(typeof options === "string" ? options : options.node);
    }
    on() {
      return this;
    }
  }
  const loaded = { exports: {} };
  const source = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    module: loaded,
    exports: loaded.exports,
    process: { env: { NODE_ENV: "test", ...(value ? { [variable]: value } : {}) } },
    require(specifier) {
      if (specifier === "@elastic/elasticsearch") return { Client: FakeClient };
      if (specifier === "ioredis") return FakeClient;
      if (specifier === "./logger") return { logger: { info() {} } };
      throw new Error("Unexpected constructor-check import");
    },
  });
  assert.equal(observed.length, 1, "Expected one mocked optional-service constructor");
  return observed[0];
}
assert.equal(
  configuredEndpoint("src/lib/elasticsearch.ts", "ELASTICSEARCH_URL"),
  populated ? "http://localhost:59201" : "http://localhost:59200",
  "Unconfigured search must use isolated port"
);
assert.equal(
  configuredEndpoint("src/lib/redis.ts", "REDIS_URL"),
  populated ? "redis://localhost:56380" : "redis://localhost:56379",
  "Unconfigured cache must use isolated port"
);
assert.equal(
  configuredEndpoint(
    "src/lib/elasticsearch.ts",
    "ELASTICSEARCH_URL",
    "http://search.example.test:19200"
  ),
  "http://search.example.test:19200"
);
assert.equal(
  configuredEndpoint("src/lib/redis.ts", "REDIS_URL", "redis://cache.example.test:16379"),
  "redis://cache.example.test:16379"
);
console.log(
  `Source-only verification passed: ${Object.keys(pinnedTests).length} pinned test files, ${Object.keys(approvedFormattingChanges).length} approved formatting revisions, chained synthetic fixture revisions with 40 retained assertions, ${dependencyRevision ? "approved scoped Effect 3.22.1 dependency revision" : "unchanged dependency configuration"}, and four isolated fixture commands.`
);
