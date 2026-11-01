const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, '../index.html');

test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

// Helper run inside the page: build a demo by hand and return its trace summary.
const run = (page, demo) => page.evaluate(d => {
  const tr = buildTrace(d);
  const last = tr.lines.length ? tr.lines[tr.lines.length - 1].steps.slice(-1)[0] : null;
  return {
    err: tr.err,
    error: last && last.error ? { key: last.error.key, li: last.error.li } : null,
    final: last ? last.S : tr.init,
    stepCounts: tr.lines.map(l => l.steps.length),
  };
}, demo);

const stackDemo = (program, init = { arr: [null, null, null, null], size: 0, head: 0 }, max = 4) => ({
  tab: 'stack', max, impl: 'circular', names: { stack: 'ABC', queue: 'ABC' },
  structs: [{ name: 'A', type: 'stack', init }], program,
});

test('stack matches the lesson sheet (stale values stay after pop)', async ({ page }) => {
  const r = await run(page, stackDemo([
    { op: 'push', t: 'A', arg: { k: 'num', v: 4 } },
    { op: 'push', t: 'A', arg: { k: 'num', v: 2 } },
    { op: 'push', t: 'A', arg: { k: 'num', v: 1 } },
    { op: 'pop', t: 'A', dest: 'm' },
    { op: 'pop', t: 'A', dest: 'n' },
    { op: 'push', t: 'A', arg: { k: 'num', v: 7 } },
  ]));
  expect(r.err).toBeNull();
  expect(r.final.st.A).toEqual({ arr: [4, 7, 1, null], size: 2, head: 0 });
  expect(r.final.vars.m).toBe(1);
  expect(r.final.vars.n).toBe(2);
  expect(r.stepCounts).toEqual([2, 2, 2, 3, 3, 2]); // pop = 2 body steps + assignment
});

test('circular queue wraps around (lesson "consider" example)', async ({ page }) => {
  const r = await run(page, {
    tab: 'queue', max: 8, impl: 'circular', names: { stack: 'XYZ', queue: 'XYZ' },
    structs: [{ name: 'X', type: 'queue', init: { arr: [6, 2, null, null, null, 4, 7, 3], size: 5, head: 5 } }],
    program: [
      { op: 'enqueue', t: 'X', arg: { k: 'num', v: 9 } },
      { op: 'dequeue', t: 'X', dest: 'k' },
    ],
  });
  expect(r.final.st.X).toEqual({ arr: [6, 2, 9, null, null, 4, 7, 3], size: 5, head: 6 });
  expect(r.final.vars.k).toBe(4);
});

test('circular head wraps from MAX-1 to 0', async ({ page }) => {
  const r = await run(page, {
    tab: 'queue', max: 4, impl: 'circular', names: { stack: 'XYZ', queue: 'XYZ' },
    structs: [{ name: 'X', type: 'queue', init: { arr: [null, null, null, 5], size: 1, head: 3 } }],
    program: [{ op: 'dequeue', t: 'X', dest: 'm' }],
  });
  expect(r.final.st.X.head).toBe(0);
  expect(r.final.st.X.size).toBe(0);
});

test('linear queue dequeue shifts with one step per loop pass', async ({ page }) => {
  const r = await run(page, {
    tab: 'queue', max: 6, impl: 'linear', names: { stack: 'PQR', queue: 'PQR' },
    structs: [{ name: 'P', type: 'queue', init: { arr: [3, 8, 7, 5, null, null], size: 4, head: 0 } }],
    program: [{ op: 'dequeue', t: 'P', dest: 'd' }],
  });
  // temp, 3 passes, size, return, assignment
  expect(r.stepCounts).toEqual([7]);
  expect(r.final.st.P).toEqual({ arr: [8, 7, 5, 5, null, null], size: 3, head: 0 });
  expect(r.final.vars.d).toBe(3);
});

test('nested Push(B, Pop(A)) moves the value', async ({ page }) => {
  const r = await run(page, {
    tab: 'stack', max: 4, impl: 'circular', names: { stack: 'ABC', queue: 'ABC' },
    structs: [
      { name: 'A', type: 'stack', init: { arr: [1, 2, null, null], size: 2, head: 0 } },
      { name: 'B', type: 'stack', init: { arr: [null, null, null, null], size: 0, head: 0 } },
    ],
    program: [{ op: 'push', t: 'B', arg: { k: 'call', op: 'pop', t: 'A' } }],
  });
  expect(r.final.st.A.size).toBe(1);
  expect(r.final.st.B).toEqual({ arr: [2, null, null, null], size: 1, head: 0 });
});

test('runtime errors: pop empty, push full, unassigned variable', async ({ page }) => {
  let r = await run(page, stackDemo([{ op: 'pop', t: 'A', dest: 'm' }]));
  expect(r.err).toBe(0);
  expect(r.error.key).toBe('errEmpty');

  r = await run(page, stackDemo([{ op: 'push', t: 'A', arg: { k: 'num', v: 9 } }], { arr: [1, 2, 3, 4], size: 4, head: 0 }));
  expect(r.error.key).toBe('errFull');

  r = await run(page, stackDemo([
    { op: 'push', t: 'A', arg: { k: 'num', v: 9 } },
    { op: 'push', t: 'A', arg: { k: 'var', n: 'n' } },
    { op: 'push', t: 'A', arg: { k: 'num', v: 8 } },
  ]));
  expect(r.err).toBe(1);
  expect(r.error.key).toBe('errVar');
  expect(r.stepCounts).toEqual([2, 1]); // later lines are never reached
});

test('random programs never hit a runtime error and keep values unique', async ({ page }) => {
  const bad = await page.evaluate(() => {
    const problems = [];
    for (let n = 0; n < 300; n++) {
      const tab = TABS[n % 3];
      const d = newDemo(tab);
      d.max = 4 + (n % 7);
      if (n % 2) d.impl = 'linear';
      if (tab !== 'stack' && n % 5 === 0) { d.structs.push({ name: nextName(d, 'queue'), type: 'queue' }); }
      fillContents(d);
      d.program = randomProgram(d);
      if (!validDemo(d)) problems.push('invalid ' + JSON.stringify(d));
      const tr = buildTrace(d);
      if (tr.err !== null) problems.push('error ' + JSON.stringify(d));
      const vals = [...initValues(d), ...progLiterals(d)];
      if (new Set(vals).size !== vals.length) problems.push('dup ' + JSON.stringify(d));
      if (d.program.length < 4) problems.push('short ' + d.program.length);
    }
    return problems.slice(0, 5);
  });
  expect(bad).toEqual([]);
});

test('share link round-trips', async ({ page }) => {
  const ok = await page.evaluate(() => {
    const d = newDemo('mixed');
    d.program = randomProgram(d);
    return JSON.stringify(decodeDemo(encodeDemo(d))) === JSON.stringify(d);
  });
  expect(ok).toBe(true);
});
