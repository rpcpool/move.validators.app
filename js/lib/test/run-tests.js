const fs = require("fs");
const path = require("path");
const { LiteTest } = require("./lite-test");

async function runTests(startingFolder) {
  const folders = [];
  let totalPassed = 0;
  let totalFailed = 0;

  function collectFolders(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        folders.push(itemPath);
        collectFolders(itemPath); // Recursively collect subdirectories
      }
    }
  }

  async function collectAndRunTests() {
    for (let folder of folders) {
      const files = fs.readdirSync(folder);
      for (const file of files) {
        if (file.endsWith("-test.js")) {
          const filePath = path.join(folder, file);
          const { filename, results } = await LiteTest.run(filePath);
          console.log(`Running tests in: ${filename}`);

          let passed = 0;
          let failed = 0;

          for (const result of results) {
            if (result.passed) {
              console.log(`\x1b[32m✓\x1b[0m ${result.description}`);
              passed++;
            } else {
              console.log(`\x1b[31m✗\x1b[0m ${result.description}`);
              console.error(result.errorMessage);
              failed++;
            }
          }

          console.log(`\nFinished ${results.length} tests in ${filename}`);
          console.log(
            `\x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m\n`,
          );

          totalPassed += passed;
          totalFailed += failed;
        }
      }
    }
  }

  // Start collecting folders from the starting folder
  collectFolders(startingFolder);

  // Run tests in collected folders
  await collectAndRunTests();

  // Print the final count of all passing and failed tests
  console.log(`\nFinal Test Results:`);
  console.log(
    `\x1b[32m${totalPassed} total tests passed\x1b[0m, \x1b[31m${totalFailed} total tests failed\x1b[0m`,
  );
}

runTests(path.join(__dirname, "..", "..", "test")).catch((error) => {
  console.error("Error running tests:", error);
  process.exit(1);
});
