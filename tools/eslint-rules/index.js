/**
 * Local ESLint plugin exposing Spin's project-specific rules.
 * Referenced in .eslintrc.cjs as the `spin` plugin.
 */
module.exports = {
  rules: {
    'no-math-random': require('./no-math-random.js'),
  },
};
