import { test, expect } from '../fixtures/app.js';

test('T10: Vector2 math utilities', async ({ page }) => {
  // Test Constructor
  await test.step('Constructor', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2();
      const v2 = new window.Vector2(5, 10);
      return {
        v1: { x: v1.x, y: v1.y },
        v2: { x: v2.x, y: v2.y }
      };
    });
    expect(results.v1.x).toBe(0);
    expect(results.v1.y).toBe(0);
    expect(results.v2.x).toBe(5);
    expect(results.v2.y).toBe(10);
  });

  // Test add — receiver must be unchanged (non-mutating contract)
  await test.step('add(v)', async () => {
    const result = await page.evaluate(() => {
      const v1 = new window.Vector2(1, 2);
      const v2 = new window.Vector2(3, 4);
      const v3 = v1.add(v2);
      return { result: { x: v3.x, y: v3.y }, receiver: { x: v1.x, y: v1.y } };
    });
    expect(result.result.x).toBe(4);
    expect(result.result.y).toBe(6);
    expect(result.receiver.x).toBe(1);
    expect(result.receiver.y).toBe(2);
  });

  // Test sub — receiver must be unchanged (non-mutating contract)
  await test.step('sub(v)', async () => {
    const result = await page.evaluate(() => {
      const v1 = new window.Vector2(5, 7);
      const v2 = new window.Vector2(2, 3);
      const v3 = v1.sub(v2);
      return { result: { x: v3.x, y: v3.y }, receiver: { x: v1.x, y: v1.y } };
    });
    expect(result.result.x).toBe(3);
    expect(result.result.y).toBe(4);
    expect(result.receiver.x).toBe(5);
    expect(result.receiver.y).toBe(7);
  });

  // Test mul — receiver must be unchanged (non-mutating contract)
  await test.step('mul(scalar)', async () => {
    const result = await page.evaluate(() => {
      const v1 = new window.Vector2(2, 3);
      const v2 = v1.mul(3);
      return { result: { x: v2.x, y: v2.y }, receiver: { x: v1.x, y: v1.y } };
    });
    expect(result.result.x).toBe(6);
    expect(result.result.y).toBe(9);
    expect(result.receiver.x).toBe(2);
    expect(result.receiver.y).toBe(3);
  });

  // Test div — receiver must be unchanged (non-mutating contract)
  await test.step('div(scalar)', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2(4, 8);
      const v2 = v1.div(2);
      const v3 = v1.div(0);
      return {
        v2: { x: v2.x, y: v2.y },
        v3: { x: v3.x, y: v3.y },
        receiver: { x: v1.x, y: v1.y }
      };
    });
    expect(results.v2.x).toBe(2);
    expect(results.v2.y).toBe(4);
    expect(results.v3.x).toBe(0);
    expect(results.v3.y).toBe(0);
    expect(results.receiver.x).toBe(4);
    expect(results.receiver.y).toBe(8);
  });

  // Test length and lengthSquared
  await test.step('length and lengthSquared', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2(3, 4);
      return {
        len: v1.length(),
        lenSq: v1.lengthSquared()
      };
    });
    expect(results.len).toBe(5);
    expect(results.lenSq).toBe(25);
  });

  // Test normalize — receiver must be unchanged (non-mutating contract)
  await test.step('normalize()', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2(3, 0);
      const v2 = v1.normalize();
      const v3 = new window.Vector2(0, 0);
      const v4 = v3.normalize();
      return {
        v2: { x: v2.x, y: v2.y },
        v4: { x: v4.x, y: v4.y },
        receiver: { x: v1.x, y: v1.y }
      };
    });
    expect(results.v2.x).toBe(1);
    expect(results.v2.y).toBe(0);
    expect(results.v4.x).toBe(0);
    expect(results.v4.y).toBe(0);
    expect(results.receiver.x).toBe(3);
    expect(results.receiver.y).toBe(0);
  });

  // Test dot
  await test.step('dot(v)', async () => {
    const result = await page.evaluate(() => {
      const v1 = new window.Vector2(1, 2);
      const v2 = new window.Vector2(3, 4);
      return v1.dot(v2);
    });
    expect(result).toBe(11); // 1*3 + 2*4 = 3 + 8 = 11
  });

  // Test distanceTo
  await test.step('distanceTo(v)', async () => {
    const result = await page.evaluate(() => {
      const v1 = new window.Vector2(1, 2);
      const v2 = new window.Vector2(4, 6);
      return v1.distanceTo(v2);
    });
    expect(result).toBe(5);
  });

  // Test clone
  await test.step('clone()', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2(10, 20);
      const v2 = v1.clone();
      return {
        v2: { x: v2.x, y: v2.y },
        isSame: v1 === v2
      };
    });
    expect(results.v2.x).toBe(10);
    expect(results.v2.y).toBe(20);
    expect(results.isSame).toBe(false);
  });

  // Test set
  await test.step('set(x, y)', async () => {
    const results = await page.evaluate(() => {
      const v1 = new window.Vector2(1, 1);
      const v2 = v1.set(10, 20);
      return {
        v1: { x: v1.x, y: v1.y },
        isSame: v1 === v2
      };
    });
    expect(results.v1.x).toBe(10);
    expect(results.v1.y).toBe(20);
    expect(results.isSame).toBe(true);
  });

  // Test static fromAngle
  await test.step('static fromAngle(angle, length)', async () => {
    const results = await page.evaluate(() => {
      const v1 = window.Vector2.fromAngle(0, 10);
      const v2 = window.Vector2.fromAngle(Math.PI / 2, 5);
      return {
        v1: { x: v1.x, y: v1.y },
        v2: { x: v2.x, y: v2.y }
      };
    });
    expect(results.v1.x).toBeCloseTo(10);
    expect(results.v1.y).toBeCloseTo(0);
    expect(results.v2.x).toBeCloseTo(0);
    expect(results.v2.y).toBeCloseTo(5);
  });

  // Test static random — deterministic via Math.random stub
  await test.step('static random(minX, maxX, minY, maxY)', async () => {
    const results = await page.evaluate(() => {
      const originalRandom = Math.random;
      const randomValues = [0.25, 0.75];
      let index = 0;
      Math.random = () => randomValues[index++];
      try {
        const v1 = window.Vector2.random(0, 10, 20, 30);
        return { x: v1.x, y: v1.y };
      } finally {
        Math.random = originalRandom;
      }
    });
    expect(results.x).toBeCloseTo(2.5);  // 0 + 0.25 * (10 - 0)
    expect(results.y).toBeCloseTo(27.5); // 20 + 0.75 * (30 - 20)
  });
});
