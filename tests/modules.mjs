export const compiled = path => {
  if (!process.env.TEST_BUILD_ROOT) throw new Error('Run tests with npm test, or node tools/test.mjs <script>.');
  return import(new URL(`src/${path}.js`, process.env.TEST_BUILD_ROOT));
};
