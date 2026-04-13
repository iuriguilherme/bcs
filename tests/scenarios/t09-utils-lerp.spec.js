import { test, expect } from '../fixtures/app.js';

test('T09: Utils.lerp correctly interpolates values', async ({ page }) => {
  const testCases = [
    { a: 10, b: 20, t: 0, expected: 10, name: 'Edge case t=0' },
    { a: 10, b: 20, t: 1, expected: 20, name: 'Edge case t=1' },
    { a: 10, b: 20, t: 0.5, expected: 15, name: 'Midpoint t=0.5' },
    { a: 10, b: 20, t: -1, expected: 0, name: 'Extrapolation t=-1' },
    { a: 10, b: 20, t: 2, expected: 30, name: 'Extrapolation t=2' },
    { a: 20, b: 10, t: 0.25, expected: 17.5, name: 'Decreasing range' },
    { a: 10, b: 10, t: 0.5, expected: 10, name: 'Equal values' },
  ];

  for (const { a, b, t, expected, name } of testCases) {
    const result = await page.evaluate(({ a, b, t }) => {
      return window.Utils.lerp(a, b, t);
    }, { a, b, t });

    expect(result, `${name} failed`).toBe(expected);
  }
});
