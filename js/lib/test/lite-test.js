const assert = require("assert");

function test(description, callback) {
  LiteTest.tests.push({ description, callback });
}

function refute(actual, expected, message) {
  try {
    assert.notStrictEqual(actual, expected);
  } catch (error) {
    const stackLines = error.stack.split("\n");
    const relevantLine = stackLines.find(
      (line) => line.includes("test/") && !line.includes("lite-test.js"),
    );
    throw new Error(
      `${message || "Refute assertion failed"}\n  ${relevantLine}`,
    );
  }
}

class LiteTest {
  static tests = [];

  static async run(filename) {
    require(filename); // Require the test file to register tests
    const results = [];

    for (const test of LiteTest.tests) {
      try {
        await test.callback();
        results.push({ description: test.description, passed: true });
      } catch (error) {
        const stackLines = error.stack.split("\n");
        const relevantLine = stackLines.find(
          (line) =>
            line.includes("Object.callback") && !line.includes("lite-test.js"),
        );
        const errorMessage = error.message.includes("/test")
          ? `  ${error.message}`
          : `  ${error.message}\n  ${relevantLine}`;
        results.push({
          description: test.description,
          passed: false,
          errorMessage,
        });
      }
    }

    LiteTest.tests = []; // Reset the tests array for the next file
    return { filename, results };
  }
}

module.exports = { test, refute, LiteTest };
