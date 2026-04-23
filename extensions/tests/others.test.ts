import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { loadMergedOptionalExtensionsState } from "../others/config.js";

test("optional extensions default to enabled", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-others-default-"));
  const config = loadMergedOptionalExtensionsState(cwd);

  assert.deepEqual(config, {
    handoff: true,
    notify: true,
    minimalMode: true,
    footerBadges: true,
  });
});

test("optional extensions merge project overrides", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-others-project-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify([
      { extension: "handoff", enabled: false },
      { extension: "notify", enabled: false },
      { extension: "minimal-mode", enabled: true },
      { extension: "footer-badges", enabled: false },
    ]),
    "utf-8",
  );

  const config = loadMergedOptionalExtensionsState(cwd);
  assert.deepEqual(config, {
    handoff: false,
    notify: false,
    minimalMode: true,
    footerBadges: false,
  });
});

test("optional extensions accept minimal_mode alias", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-others-alias-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify({ extension: "minimal_mode", enabled: false }),
    "utf-8",
  );

  const config = loadMergedOptionalExtensionsState(cwd);
  assert.equal(config.minimalMode, false);
});

test("optional extensions accept footer aliases", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-others-footer-alias-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify({ footerRedesign: false }),
    "utf-8",
  );

  const config = loadMergedOptionalExtensionsState(cwd);
  assert.equal(config.footerBadges, false);
});

test("optional extensions support legacy object-shaped config", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ramean-others-legacy-"));
  fs.mkdirSync(path.join(cwd, ".pi", "ramean"), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, ".pi", "ramean", "config.yaml"),
    stringify({
      handoff: false,
      notify: { enabled: false },
      minimalMode: false,
    }),
    "utf-8",
  );

  const config = loadMergedOptionalExtensionsState(cwd);
  assert.deepEqual(config, {
    handoff: false,
    notify: false,
    minimalMode: false,
    footerBadges: true,
  });
});
