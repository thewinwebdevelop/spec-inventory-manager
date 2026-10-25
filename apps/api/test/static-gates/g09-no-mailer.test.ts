// F-003 · T-003-QA02 — G-09 (F-002 test-plan §10 · F-003 test-plan §5.2 · D-012).
//
// Invitations hand the Owner a link to copy (D-012); the API sends no email.
// A mailer arriving quietly would change what an invitation IS (a credential
// now sitting in somebody's inbox) without anyone deciding it. G-09 fails the
// moment one arrives, from either direction:
//   1. package.json — `apps/api` and every workspace package it depends on.
//   2. code — importing/requiring a mailer, or speaking SMTP by hand.
import { describe, it, expect } from "vitest";
import {
  fixture,
  fixtureNames,
  lineOf,
  productionFiles,
  readCode,
  readRaw,
  type Violation,
} from "./scan";

/** Package names that send mail. "mail" covers nodemailer, @sendgrid/mail, mailgun, mailjet, … */
const MAILER_PACKAGE =
  /mail|smtp|sendgrid|postmark|mandrill|sparkpost|sendinblue|brevo|^resend$|client-ses/i;
const SPECIFIER = /\b(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)(["'`])([^"'`]+)\1/g;
const SMTP_BY_HAND =
  /smtps?:\/\/|\bSMTP_[A-Z0-9_]*|\b(?:EHLO|HELO)\b|MAIL FROM:|RCPT TO:|\bcreateTransport\s*\(|\bsendMail\s*\(/g;
const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

type Manifest = Record<string, unknown>;

function depNames(manifest: Manifest): string[] {
  return DEP_SECTIONS.flatMap((s) => Object.keys((manifest[s] as Record<string, string>) ?? {}));
}

function g09Manifest(file: string, manifest: Manifest): Violation[] {
  return depNames(manifest)
    .filter((name) => MAILER_PACKAGE.test(name))
    .map((name) => ({ gate: "G-09", rule: "mailer-dependency", file, line: 0, snippet: name }));
}

function g09Code(file: string, code: string): Violation[] {
  const out: Violation[] = [];
  for (const m of code.matchAll(SPECIFIER)) {
    // Relative paths are our own modules (`./invitation-email`); a hand-rolled
    // sender among them is caught by SMTP_BY_HAND instead.
    if (!/^[./]/.test(m[2]) && MAILER_PACKAGE.test(m[2])) {
      out.push({
        gate: "G-09",
        rule: "mailer-import",
        file,
        line: lineOf(code, m.index!),
        snippet: m[0],
      });
    }
  }
  for (const m of code.matchAll(SMTP_BY_HAND)) {
    out.push({
      gate: "G-09",
      rule: "smtp-by-hand",
      file,
      line: lineOf(code, m.index!),
      snippet: m[0],
    });
  }
  return out;
}

/** `apps/api/package.json` plus every workspace package reachable through `dependencies`. */
function reachableManifests(): Map<string, Manifest> {
  const byName = new Map<string, string>();
  for (const dir of ["config", "contracts", "core-domain", "db", "connectors"]) {
    const rel = `packages/${dir}/package.json`;
    byName.set(JSON.parse(readRaw(rel)).name, rel);
  }
  const seen = new Map<string, Manifest>();
  const queue = ["apps/api/package.json"];
  while (queue.length > 0) {
    const rel = queue.shift()!;
    if (seen.has(rel)) continue;
    const manifest = JSON.parse(readRaw(rel)) as Manifest;
    seen.set(rel, manifest);
    for (const [name, range] of Object.entries(
      (manifest.dependencies as Record<string, string>) ?? {},
    )) {
      if (range.startsWith("workspace:")) {
        const next = byName.get(name);
        expect(
          next,
          `workspace dependency ${name} is not a known package — G-09 would skip it`,
        ).toBeDefined();
        queue.push(next!);
      }
    }
  }
  return seen;
}

const manifests = reachableManifests();
const files = productionFiles();

describe("G-09 · the API sends no email (no mailer dependency, no mailer code)", () => {
  it("non-vacuity: the manifests and the imports were actually read", () => {
    expect([...manifests.keys()].sort()).toEqual(
      expect.arrayContaining([
        "apps/api/package.json",
        "packages/core-domain/package.json",
        "packages/db/package.json",
      ]),
    );
    const names = [...manifests.values()].flatMap(depNames);
    expect(names).toContain("@nestjs/common");
    expect(names.length).toBeGreaterThan(20);
    const specifiers = files.flatMap((f) => [...readCode(f).matchAll(SPECIFIER)].map((m) => m[2]));
    expect(specifiers).toContain("@nestjs/common");
    expect(
      specifiers.length,
      "the import extractor found almost nothing — it is blind",
    ).toBeGreaterThan(100);
  });

  it("★ no reachable package.json depends on a mailer", () => {
    const offenders = [...manifests].flatMap(([rel, m]) => g09Manifest(rel, m));
    expect(offenders).toEqual([]);
  });

  it("★ no production code imports a mailer or speaks SMTP", () => {
    expect(files.flatMap((f) => g09Code(f, readCode(f)))).toEqual([]);
  });

  it("FIXTURE g09-package.json.fixture turns the gate red (mailer-dependency)", () => {
    const found = g09Manifest(
      "fixture",
      JSON.parse(readRaw(`apps/api/test/static-gates/__gate_fixtures__/g09-package.json.fixture`)),
    );
    expect(found).toEqual([
      expect.objectContaining({ rule: "mailer-dependency", snippet: "nodemailer" }),
    ]);
  });

  it.each([
    ["g09-import-nodemailer.fixture", "mailer-import"],
    ["g09-raw-smtp.fixture", "smtp-by-hand"],
  ])("FIXTURE %s turns the gate red (%s)", (name, rule) => {
    expect(g09Code(name, fixture(name)).map((v) => v.rule)).toContain(rule);
  });

  it("every g09 fixture on disk is exercised above", () => {
    expect(fixtureNames("g09-")).toEqual([
      "g09-import-nodemailer.fixture",
      "g09-package.json.fixture",
      "g09-raw-smtp.fixture",
    ]);
  });

  it("SELF-CHECK: flags mailers in both places, clears ordinary code", () => {
    for (const name of [
      "nodemailer",
      "@sendgrid/mail",
      "@nestjs-modules/mailer",
      "mailgun.js",
      "postmark",
      "resend",
      "@aws-sdk/client-sesv2",
      "@types/nodemailer",
    ]) {
      expect(
        g09Manifest("self", { devDependencies: { [name]: "1" } }).length,
        `NOT FLAGGED: ${name}`,
      ).toBe(1);
    }
    for (const s of [
      'import { createTransport } from "nodemailer";',
      'const sg = require("@sendgrid/mail");',
      'const m = await import("mailgun.js");',
      'import "nodemailer";',
      "const host = process.env.SMTP_HOST;",
      "transporter.sendMail({ to })",
      'socket.write("EHLO omnistock\\r\\n")',
    ]) {
      expect(g09Code("self", s).length, `NOT FLAGGED: ${s}`).toBeGreaterThan(0);
    }
    expect(
      g09Manifest("self", { dependencies: { "@nestjs/common": "1", ioredis: "1", argon2: "1" } }),
    ).toEqual([]);
    for (const s of [
      'import { Injectable } from "@nestjs/common";',
      'import { normalizeEmail } from "../auth/email";',
      'export * from "./invitation-email";',
      "const email = normalizeEmail(dto.email);",
      'throw domainError("EMAIL_INVALID");',
      "// no resend: the token is stored as an HMAC",
    ]) {
      expect(g09Code("self", s), `FALSE POSITIVE: ${s}`).toEqual([]);
    }
  });
});
