// F-002 — parsing the decorators attached to a `@Controller(...)` class.
//
// Split out of the test so it can be tested ITSELF. That is not ceremony: the
// first version of this gate lived inside the test file as a regex, and the
// regex was wrong in a way no test could have caught, because the only thing
// exercising it was the very assertion it silently made vacuous.
//
// ── The bug this file exists because of ────────────────────────────────────
// The original pattern required the tier decorators to sit IMMEDIATELY above
// `@Controller`:
//
//     /((?:@(?:Public|UserScoped|SystemScoped)\(\)\s*\n\s*)*)@Controller\(/
//
// One unrelated decorator in between and the capture group came back empty —
// so a class-level `@UserScoped()` on an `:orgId` controller reported CLEAN:
//
//     @UserScoped()
//     @Injectable()          ← this line alone defeated the whole gate
//     @Controller("orgs/:orgId/roles")
//
// Decorator order is free in TypeScript, so this is not an exotic shape.
// Worse, it is the shape a developer reaches for when adding `@Injectable()`
// or `@ApiTags()` to an existing controller — i.e. it appears through an
// ordinary edit, not a deliberate one.
//
// The parser now walks backwards over the whole decorator block instead.

const TIER_DECORATORS = ["Public", "UserScoped", "SystemScoped"] as const;

export interface ControllerDecl {
  readonly file: string;
  /** The route prefix, `"/"` when `@Controller()` takes no argument. */
  readonly path: string;
  /** Tier decorators attached to the CLASS, in source order. */
  readonly classMarks: readonly string[];
}

/**
 * True for a line that is part of a class's decorator block: a decorator, a
 * continuation of one, a comment, or blank. Anything else (an import, a
 * closing brace, a statement) means we have walked off the top of the block.
 */
function isDecoratorBlockLine(line: string): boolean {
  const t = line.trim();
  if (t === "") return true;
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) return true;
  if (t.startsWith("@")) return true;
  // A continuation line of a multi-line decorator argument, e.g.
  //   @ApiTags(
  //     "orgs",
  //   )
  // These never start a statement; treat only clearly-code lines as the stop.
  return !/\b(import|export|class|const|let|var|function|interface|type)\b/.test(t) && !t.endsWith("}");
}

/**
 * Parses every `@Controller(...)` in one source file.
 *
 * Deliberately a line walk rather than a single regex: the decorators of a
 * class are a BLOCK, and the property under test ("does a tier mark appear
 * anywhere in that block") is not something a fixed-shape pattern expresses
 * without assuming an ordering the language does not impose.
 */
export function parseControllers(file: string, source: string): ControllerDecl[] {
  const lines = source.split("\n");
  const found: ControllerDecl[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^@Controller\(\s*(?:"([^"]*)"|'([^']*)')?/);
    if (!match) continue;

    const marks: string[] = [];
    for (let j = i - 1; j >= 0; j -= 1) {
      if (!isDecoratorBlockLine(lines[j])) break;
      const tier = lines[j].trim().match(/^@(\w+)\(\)/);
      if (tier && (TIER_DECORATORS as readonly string[]).includes(tier[1])) {
        marks.unshift(`@${tier[1]}()`);
      }
    }

    found.push({ file, path: match[1] ?? match[2] ?? "/", classMarks: marks });
  }

  return found;
}
