import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  allProfiles,
  assertCiGitClean,
  assertFile,
  compose,
  gitDirty,
  gitSha,
  npxSupabase,
  repositoryRoot,
  run,
  sha256File,
  validationImageTag,
} from "./common.mjs";

assertCiGitClean();

const configPath = resolve(repositoryRoot, "supabase/config.toml");
const validationDir = resolve(repositoryRoot, "supabase/validation");
const pgTapContract = resolve(repositoryRoot, "infra/docker/sql/database-contract.test.sql");
const artifactsDir = resolve(repositoryRoot, "artifacts/docker");
const upOnly = process.argv.includes("--up-only");
const keepSupabaseRunning =
  upOnly || String(process.env.DOCKER_KEEP_SUPABASE_RUNNING || "").toLowerCase() === "true";

assertFile(
  configPath,
  "supabase/config.toml is required; the Docker profile will not create a second Postgres stack.",
);
assertFile(pgTapContract);

const sha = gitSha();
const environment = {
  GIT_SHA: sha,
  UNIVERSE_DOCKER_TAG: validationImageTag(sha),
};

run("docker", ["version"]);
compose([...allProfiles(), "config", "--quiet"], { env: environment });

function supabaseIsRunning() {
  const result = npxSupabase(["status", "--output", "json", "--workdir", repositoryRoot], {
    allowFailure: true,
    capture: true,
  });
  return result.status === 0;
}

function databaseContainerName() {
  const config = readFileSync(configPath, "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
  if (!projectId) throw new Error("supabase/config.toml must contain a safe project_id.");
  return `supabase_db_${projectId}`;
}

function validateSqlPack() {
  const container = databaseContainerName();
  const files = readdirSync(validationDir)
    .filter((name) => /^\d+.*[.]sql$/u.test(name))
    .sort();
  if (files.length === 0) throw new Error("No SQL validation files were found.");
  for (const file of files) {
    const containerPath = `/tmp/universe-${file}`;
    try {
      run("docker", ["cp", resolve(validationDir, file), `${container}:${containerPath}`]);
      run("docker", [
        "exec",
        container,
        "psql",
        "--set",
        "ON_ERROR_STOP=1",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
        "--file",
        containerPath,
      ]);
    } finally {
      run("docker", ["exec", container, "rm", "-f", containerPath], {
        allowFailure: true,
        capture: true,
      });
    }
  }
}

function restoreProbe() {
  mkdirSync(artifactsDir, { recursive: true });
  const container = databaseContainerName();
  const containerDump = "/tmp/universe-docker-validation.dump";
  const hostDump = resolve(artifactsDir, "restore-probe.dump");
  const psql = (sql, options = {}) =>
    run(
      "docker",
      [
        "exec",
        container,
        "psql",
        "--set",
        "ON_ERROR_STOP=1",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
        ...(options.tuples ? ["--tuples-only", "--no-align"] : []),
        "--command",
        sql,
      ],
      options.capture ? { capture: true } : {},
    );

  run("docker", ["inspect", container]);
  rmSync(hostDump, { force: true });
  try {
    psql(
      "drop schema if exists docker_validation cascade; create schema docker_validation; create table docker_validation.restore_probe(id integer primary key, value text not null); insert into docker_validation.restore_probe values (1, 'alpha'), (2, 'beta');",
    );
    run("docker", [
      "exec",
      container,
      "pg_dump",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
      "--format",
      "custom",
      "--schema",
      "docker_validation",
      "--no-owner",
      "--no-privileges",
      "--file",
      containerDump,
    ]);
    run("docker", ["cp", `${container}:${containerDump}`, hostDump]);
    psql("drop schema docker_validation cascade;");
    run("docker", [
      "exec",
      container,
      "pg_restore",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      containerDump,
    ]);
    const restored = String(
      psql(
        "select string_agg(id::text || ':' || value, ',' order by id) from docker_validation.restore_probe;",
        { capture: true, tuples: true },
      ).stdout || "",
    ).trim();
    if (restored !== "1:alpha,2:beta") {
      throw new Error(`Restore probe mismatch: ${restored || "empty"}`);
    }
    return sha256File(hostDump);
  } finally {
    psql("drop schema if exists docker_validation cascade;", { capture: true });
    run("docker", ["exec", container, "rm", "-f", containerDump], {
      allowFailure: true,
      capture: true,
    });
  }
}

const stackWasRunning = supabaseIsRunning();
let restoreChecksum = "";
try {
  if (!stackWasRunning) {
    npxSupabase(["start", "--workdir", repositoryRoot]);
  }
  compose(["--profile", "test", "build", "--pull", "test-runner"], { env: environment });

  if (upOnly) {
    process.stdout.write("[docker-test] canonical Supabase stack and tooling image are ready.\n");
    process.exit(0);
  }

  npxSupabase(["db", "reset", "--local", "--no-seed", "--workdir", repositoryRoot]);
  npxSupabase([
    "db",
    "lint",
    "--local",
    "--level",
    "error",
    "--fail-on",
    "error",
    "--workdir",
    repositoryRoot,
  ]);
  validateSqlPack();
  npxSupabase(["test", "db", "--local", pgTapContract, "--workdir", repositoryRoot]);
  restoreChecksum = restoreProbe();
  compose(["--profile", "test", "run", "--rm", "--no-deps", "test-runner"], {
    env: environment,
  });

  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(
    resolve(artifactsDir, "test-evidence.json"),
    `${JSON.stringify(
      {
        gitSha: sha,
        gitDirty: gitDirty(),
        profile: "test",
        restoreProbeSha256: restoreChecksum,
        supabaseCli: "2.116.0",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  const cleanupErrors = [];
  try {
    compose([...allProfiles(), "down", "--remove-orphans"], { env: environment });
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (!stackWasRunning && !keepSupabaseRunning) {
    try {
      npxSupabase(["stop", "--workdir", repositoryRoot]);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Docker validation cleanup failed.");
  }
}
