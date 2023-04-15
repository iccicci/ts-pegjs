import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { exec as execNode } from 'node:child_process';
import peggy from 'peggy';

// Local imports
import tspegjs from '../src/tspegjs';
import { TsPegjsOptions } from '../src/types';

const exec = promisify(execNode);

const EXAMPLES_DIR = fileURLToPath(new URL('../examples', import.meta.url));

describe('Automatic type generation', () => {
  {
    const sampleGrammarName = 'arithmetics.pegjs';
    const grammarFile = path.join(EXAMPLES_DIR, sampleGrammarName);
    it(`Can generate types for \`${sampleGrammarName}\``, async () => {
      expect(
        await generateParser(grammarFile, `// Arithmetic`, {
          Integer: 'number',
          Expression: 'number',
          Term: 'number',
          Factor: 'number'
        })
      ).toMatchInlineSnapshot(`
      "// Arithmetic
      // These types were autogenerated by ts-pegjs
      export type Expression = number;
      type Term = number;
      type Factor = number;
      type Integer = number;
      type _ = string[];
      "
    `);
      expect(await generateParser(grammarFile, `// Arithmetic`, { Term: 'number' }))
        .toMatchInlineSnapshot(`
        "// Arithmetic
        // These types were autogenerated by ts-pegjs
        export type Expression = number;
        type Term = number;
        type Factor = Expression | Integer;
        type Integer = number;
        type _ = string[];
        "
      `);
    });
  }
  {
    const sampleGrammarName = 'minimal.pegjs';
    const grammarFile = path.join(EXAMPLES_DIR, sampleGrammarName);
    it(`Can generate types for \`${sampleGrammarName}\``, async () => {
      expect(
        await generateParser(grammarFile, `// Arithmetic`, {
          START: 'string'
        })
      ).toMatchInlineSnapshot(`
        "// Arithmetic
        // These types were autogenerated by ts-pegjs
        export type START = string;
        "
      `);
      expect(await generateParser(grammarFile, `// Arithmetic`, {})).toMatchInlineSnapshot(`
          "// Arithmetic
          // These types were autogenerated by ts-pegjs
          export type START = \\"a\\" | \\"b\\";
          "
        `);
    });
  }
  {
    const sampleGrammarName = 'snake-case-rules.pegjs';
    const grammarFile = path.join(EXAMPLES_DIR, sampleGrammarName);
    it(`Can generate types for \`${sampleGrammarName}\``, async () => {
      expect(await generateParser(grammarFile, '', {}, { doNotCamelCaseTypes: true }))
        .toMatchInlineSnapshot(`
          "
          // These types were autogenerated by ts-pegjs
          export type start = string | other_rule;
          type other_rule = string;
          "
        `);
      expect(await generateParser(grammarFile, '', {}, { doNotCamelCaseTypes: false }))
        .toMatchInlineSnapshot(`
          "
          // These types were autogenerated by ts-pegjs
          export type Start = string | OtherRule;
          type OtherRule = string;
          "
        `);
      // Default behavior is to CamelCase type names.
      expect(await generateParser(grammarFile, '', {})).toMatchInlineSnapshot(`
          "
          // These types were autogenerated by ts-pegjs
          export type Start = string | OtherRule;
          type OtherRule = string;
          "
        `);
    });
  }
  {
    const sampleGrammarName = 'bad-examples-1.pegjs';
    const grammarFile = path.join(EXAMPLES_DIR, sampleGrammarName);
    it(`Can generate types for \`${sampleGrammarName}\``, async () => {
      expect(await generateParser(grammarFile, '', {}))
        .toMatchInlineSnapshot(`
          "
          // These types were autogenerated by ts-pegjs
          export type WhiteSpace =
            | \\"\\\\t\\"
            | \\"\\\\u000b\\"
            | \\"\\\\f\\"
            | \\" \\"
            | \\"\\\\u00a0\\"
            | \\"\\\\ufeff\\"
            | Zs;
          type LineTerminator = string;
          type LineTerminatorSequence = \\"\\\\n\\" | \\"\\\\r\\\\n\\" | \\"\\\\r\\" | \\"\\\\u2028\\" | \\"\\\\u2029\\";
          type Zs = string;
          "
        `);
    });
  }
});

async function generateParser(
  inFile: string,
  customHeader = '// customHeader a\n// customHeader b',
  returnTypes: Record<string, string> = {},
  additionalOptions: TsPegjsOptions = {}
) {
  if (!existsSync(inFile)) {
    throw new Error(`File "${inFile}" doesn't exist. Cannot proceed`);
  }

  const source = await fs.readFile(inFile, { encoding: 'utf-8' });
  const parser = peggy.generate(source, {
    // @ts-ignore
    output: 'source',
    //trace: true,
    cache: true,
    plugins: [tspegjs],
    // The Peggy types do not allow extending the config when a plugin is added, so we have to disable ts temporarily
    // @ts-ignore-next-line
    tspegjs: {
      customHeader,
      onlyGenerateGrammarTypes: true,
      ...additionalOptions
    },
    returnTypes
  });
  return parser;
}