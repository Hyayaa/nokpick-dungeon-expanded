import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const sourceRoots = ["app/game", "app/presentation"];
const sourceExtensions = new Set([".ts", ".tsx"]);

const sourceFiles = sourceRoots.flatMap((root) => {
  const walk = (directory: string): string[] =>
    readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory()
        ? walk(path)
        : sourceExtensions.has(extname(path))
          ? [normalize(path)]
          : [];
    });
  return walk(root);
});

const resolveLocalImport = (sourceFile: string, specifier: string) => {
  if (!specifier.startsWith(".")) return null;
  const candidate = resolve(dirname(sourceFile), specifier);
  const resolved = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    join(candidate, "index.ts"),
    join(candidate, "index.tsx"),
  ].find((path) => sourceFiles.includes(relative(projectRoot, path)));
  return resolved ? normalize(relative(projectRoot, resolved)) : null;
};

const imports = new Map<string, string[]>();
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = syntax.statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) return [];
    return [statement.moduleSpecifier.text];
  });
  imports.set(
    file,
    specifiers.flatMap((specifier) => {
      const resolved = resolveLocalImport(file, specifier);
      return resolved ? [resolved] : [];
    }),
  );

  if (!file.startsWith("app/game/")) continue;
  specifiers.forEach((specifier) => {
    assert.doesNotMatch(
      specifier,
      /(^react(?:-dom)?$)|presentation|components/,
      `${file} must not depend on React, components, or presentation modules`,
    );
  });
  assert.doesNotMatch(
    source,
    /\b(?:window|document|CanvasRenderingContext2D|HTMLImageElement|AudioContext)\b/,
    `${file} must remain independent from browser and canvas APIs`,
  );
  assert.doesNotMatch(
    source,
    /\b(?:Date\.now|Math\.random|performance\.now)\s*\(/,
    `${file} must receive time and randomness through explicit inputs`,
  );
}

const visiting = new Set<string>();
const visited = new Set<string>();
const stack: string[] = [];
const visit = (file: string) => {
  if (visited.has(file)) return;
  if (visiting.has(file)) {
    const cycleStart = stack.indexOf(file);
    assert.fail(`source import cycle: ${[...stack.slice(cycleStart), file].join(" -> ")}`);
  }
  visiting.add(file);
  stack.push(file);
  for (const dependency of imports.get(file) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(file);
  visited.add(file);
};
sourceFiles.forEach(visit);

const actionCoordinatorSource = readFileSync(
  "app/components/DungeonGame.tsx",
  "utf8",
);
const engineSource = readFileSync("app/game/engine.ts", "utf8");
const skillBlueprintSource = readFileSync(
  "app/game/companion-skill-blueprints.ts",
  "utf8",
);
const particleEmitterSource = readFileSync(
  "app/presentation/pixel-particle-emitters.ts",
  "utf8",
);
const skillRecipeSource = readFileSync(
  "app/presentation/skill-particle-recipes.ts",
  "utf8",
);
for (const [name, source] of [
  ["DungeonGame action coordinator", actionCoordinatorSource],
  ["game engine", engineSource],
] as const) {
  assert.doesNotMatch(
    source,
    /effect\.text\s*===|(?:test|match)\s*\(\s*effect\.text\s*\)/,
    `${name} must use typed combat feedback instead of parsing display text`,
  );
}

assert.match(
  engineSource,
  /Record<CompanionSkillId, \(\) => void>/,
  "manual skills must dispatch through an exhaustive effect-handler registry",
);
assert.match(
  skillBlueprintSource,
  /deriveCompanionSkill/,
  "skill rules must expose immutable modifier composition for ranks and variants",
);
assert.match(
  engineSource,
  /deriveCompanionSkill\(skillId, modifiers\)/,
  "derived skill modifiers must feed the real rule execution path",
);
assert.match(
  engineSource,
  /definition\.specialEffects/,
  "data-only special-effect modules must execute as part of a skill cast",
);
assert.doesNotMatch(
  particleEmitterSource,
  /CompanionSkillId|COMPANION_SKILLS|drawImage|assets\/sprites/i,
  "generic particle emitters must remain reusable and independent from skill ids or sprites",
);
assert.match(
  skillRecipeSource,
  /satisfies Record<CompanionSkillId, SkillParticleRecipe>/,
  "skill particle recipes must be exhaustively keyed by every registered skill id",
);
for (const semanticField of ["travelMode", "impactMode", "rank", "variants", "accent"]) {
  assert.match(
    skillRecipeSource,
    new RegExp(`visual\\.${semanticField}`),
    `derived particle recipes must consume ${semanticField}`,
  );
}

console.log(
  `architecture smoke checks passed (${sourceFiles.length} game/presentation modules)`,
);
