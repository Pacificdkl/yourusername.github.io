/**
 * Custom ESLint rule: forbid Math.random().
 *
 * Non-negotiable #6 (CLAUDE.md §2): randomness must come from
 * `crypto.getRandomValues()`. `Math.random()` is not cryptographically secure
 * and its use anywhere in the app — especially in `src/spin/` — is a CI failure.
 *
 * Test fixtures are exempt via the ESLint config `overrides` block, not here,
 * so the rule itself stays simple and total.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Math.random(); use crypto.getRandomValues() (non-negotiable #6).',
      recommended: true,
    },
    schema: [],
    messages: {
      noMathRandom:
        'Math.random() is forbidden (CLAUDE.md non-negotiable #6). Use crypto.getRandomValues().',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        const { object, property } = node;
        if (
          object &&
          object.type === 'Identifier' &&
          object.name === 'Math' &&
          property &&
          property.type === 'Identifier' &&
          property.name === 'random'
        ) {
          context.report({ node, messageId: 'noMathRandom' });
        }
      },
    };
  },
};
