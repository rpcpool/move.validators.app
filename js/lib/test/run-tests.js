const fs = require("fs");
const path = require("path");
const { LiteTest } = require("./lite-test");

async function runTests(testFile) {
  let totalPassed = 0;
  let totalFailed = 0;

  async function runSingleTest(filePath) {
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
      `\x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m\n`
    );

    return { passed, failed };
  }

  // If a specific test file is provided, run only that test
  if (testFile) {
    const filePath = path.resolve(process.cwd(), testFile);
    if (!fs.existsSync(filePath)) {
      console.error(`Test file not found: ${filePath}`);
      process.exit(1);
    }
    const { passed, failed } = await runSingleTest(filePath);
    totalPassed = passed;
    totalFailed = failed;
  } else {
    // Run all tests if no specific file is provided
    const testDir = path.join(__dirname, "..", "..", "test");
    const folders = [];

    function collectFolders(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          folders.push(itemPath);
          collectFolders(itemPath);
        }
      }
    }

    collectFolders(testDir);

    for (let folder of folders) {
      const files = fs.readdirSync(folder);
      for (const file of files) {
        if (file.endsWith("-test.js")) {
          const filePath = path.join(folder, file);
          const { passed, failed } = await runSingleTest(filePath);
          totalPassed += passed;
          totalFailed += failed;
        }
      }
    }
  }

  console.log(`\nFinal Test Results:`);
  console.log(
    `\x1b[32m${totalPassed} total tests passed\x1b[0m, \x1b[31m${totalFailed} total tests failed\x1b[0m`
  );
}

// Get the test file path from command line arguments
const testFile = process.argv[2];
runTests(testFile).catch((error) => {
  console.error("Error running tests:", error);
  process.exit(1);
});
