const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, '../index.html');
const shots = process.env.SHOTS; // set to a directory to save screenshots

// Fixed demo so the UI tests are deterministic.
const demo = {
  tab: 'stack', max: 4, impl: 'circular', names: { stack: 'ABC', queue: 'XYZ' },
  structs: [{ name: 'A', type: 'stack', init: { arr: [5, null, null, null], size: 1, head: 0 } }],
  program: [],
};

async function load(page, d = demo) {
  await page.goto(url);
  await page.evaluate(dd => {
    localStorage.clear();
    app.tabs[dd.tab] = { demo: dd, run: null, exp: -1 };
    app.tab = dd.tab;
    app.settings.speed = 'fast';
    update(null);
  }, d);
}
const snap = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true }); };

test('build a program by clicking, run, expand, back, reset', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await load(page);

  // line 1: Push(A, 3)
  await page.click('[data-act="addline"]');
  await page.click('[data-act="chip"][data-i="0"][data-f="arg"]');
  await page.click('#menu [data-act="pick"]:text-is("3")');
  // value 5 is already in A, so it must be disabled
  await page.click('[data-act="chip"][data-i="0"][data-f="arg"]');
  await expect(page.locator('#menu [data-act="pick"]:text-is("5")')).toBeDisabled();
  await page.keyboard.press('Escape');

  // line 2: m ← Pop(A)
  await page.click('[data-act="addline"]');
  await page.click('[data-act="chip"][data-i="1"][data-f="op"]');
  await page.click('#menu [data-act="pick"]:text-is("Pop")');
  await expect(page.locator('.line').nth(1).locator('.code')).toHaveText('m ← Pop(A)');

  // line 3: Push(A, m)
  await page.click('[data-act="addline"]');
  await page.click('[data-act="chip"][data-i="2"][data-f="arg"]');
  await page.click('#menu [data-act="pick"]:text-is("m")');
  await expect(page.locator('.line').nth(2).locator('.code')).toHaveText('Push(A, m)');
  await snap(page, '01-built');

  // run line 1 collapsed
  await page.click('[data-act="run"]');
  await expect(page.locator('[data-act="addline"]')).toBeDisabled(); // locked
  await expect(page.locator('#left .tok')).toHaveCount(2);
  // line 1 just ran (amber ✓), line 2 is next (blue ▶)
  await expect(page.locator('.line').nth(0)).toHaveClass(/just/);
  await expect(page.locator('.line').nth(1)).toHaveClass(/cur/);
  await expect(page.locator('.status')).toContainText('Just ran line 1');
  await expect(page.locator('.status')).toContainText('A[1] ← 3');
  await expect(page.locator('.status')).toContainText('Next: line 2');

  // expand line 2 and step through it
  await page.click('[data-act="exp"][data-i="1"]');
  await page.click('[data-act="run"]');
  await expect(page.locator('.lrow.just code')).toHaveText('    sizeA ← sizeA − 1');
  await page.click('[data-act="view"][data-v="array"]');
  await expect(page.locator('[data-ref="var:sizeA"]')).toHaveText('1');
  // mid-line: line 2 stays "next", line 1 is now just "done"
  await expect(page.locator('.line').nth(1)).toHaveClass(/cur/);
  await expect(page.locator('.line').nth(0)).toHaveClass(/done/);
  await expect(page.locator('.status')).toContainText('Just ran line 2, step 1 of 3');
  await expect(page.locator('.status')).toContainText('Next: step 2 of line 2');
  await page.click('[data-act="run"]');
  await expect(page.locator('[data-ref="ret"]')).toHaveText('3');
  // popped value stays in the array, greyed
  await expect(page.locator('[data-ref="cell:A:1"]')).toHaveClass(/stale/);
  await page.waitForTimeout(700);
  await snap(page, '02-expanded-array');
  await page.click('[data-act="run"]');
  await expect(page.locator('[data-ref="var:m"]')).toHaveText('3');

  // back one step restores m
  await page.click('[data-act="back"]');
  await expect(page.locator('[data-ref="var:m"]')).toHaveText('—');
  await page.click('[data-act="run"]');
  await page.click('[data-act="run"]'); // line 3
  await expect(page.locator('.status')).toHaveClass(/ok/);
  await expect(page.locator('[data-act="run"]')).toBeDisabled();
  await snap(page, '03-finished');

  await page.click('[data-act="stop"]');
  await expect(page.locator('[data-act="addline"]')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('runtime error stops the program with a hint', async ({ page }) => {
  await load(page, { ...demo, program: [{ op: 'pop', t: 'A', dest: 'm' }, { op: 'pop', t: 'A', dest: 'n' }] });
  await page.click('[data-act="run"]');
  await page.click('[data-act="run"]');
  await expect(page.locator('.status.err')).toContainText('runtime error');
  await expect(page.locator('.status.err')).toContainText('IsEmpty(A)');
  await expect(page.locator('[data-ref="isempty:A"]')).toHaveClass(/alert/);
  await expect(page.locator('[data-act="run"]')).toBeDisabled();
  await snap(page, '04-runtime-error');
});

test('circular queue wrap in array view, mixed tab, dark + Chinese', async ({ page }) => {
  await load(page, {
    tab: 'mixed', max: 8, impl: 'circular', names: { stack: 'ABC', queue: 'XYZ' },
    structs: [
      { name: 'A', type: 'stack', init: { arr: [11, 12, null, null, null, null, null, null], size: 2, head: 0 } },
      { name: 'X', type: 'queue', init: { arr: [6, 2, null, null, null, 4, 7, 3], size: 5, head: 5 } },
    ],
    program: [
      { op: 'push', t: 'A', arg: { k: 'call', op: 'dequeue', t: 'X' } },
      { op: 'enqueue', t: 'X', arg: { k: 'num', v: 9 } },
    ],
  });
  await page.click('[data-act="view"][data-v="array"]');
  await expect(page.locator('.wrapline')).toHaveCount(1);
  await expect(page.locator('[data-ref="der:tailX"]')).toHaveText('1');
  await page.click('[data-act="exp"][data-i="0"]');
  await page.click('[data-act="run"]');
  await snap(page, '05-mixed-array');
  await page.click('[data-act="theme"]');
  await page.click('[data-act="lang"]');
  await page.click('[data-act="view"][data-v="graphical"]');
  await expect(page.locator('[data-act="tab"][data-tab="mixed"]')).toHaveText('混合');
  await snap(page, '06-mixed-graphical-dark-zh');
});

test('settings and program survive a reload', async ({ page }) => {
  await load(page);
  await page.click('[data-act="addline"]');
  await page.click('[data-act="lang"]');
  await page.reload();
  await expect(page.locator('.line')).toHaveCount(1);
  await expect(page.locator('[data-act="lang"]')).toHaveText('EN');
});

test('generated program is regenerated on setup change until edited', async ({ page }) => {
  await load(page);
  const check = () => page.evaluate(() => ({ gen: T().demo.generated, err: buildTrace(T().demo).err, n: T().demo.program.length }));
  for (let rep = 0; rep < 20; rep++) {
    await page.evaluate(() => doRestart(true));
    const up = await page.locator('[data-act="max"][data-d="1"]').isEnabled();
    for (const sel of [`[data-act="max"][data-d="${up ? 1 : -1}"]`, '[data-act="addst"]', '[data-act="delst"] >> nth=0']) {
      await page.click(sel);
      const r = await check();
      expect(r.gen).toBe(true);
      expect(r.err).toBeNull();
      expect(r.n).toBeGreaterThanOrEqual(4);
    }
  }
  // editing a line hands the program over to the student
  await page.click('[data-act="chip"][data-i="0"][data-f="tgt"]');
  await page.click('#menu [data-act="pick"] >> nth=0');
  const before = await page.evaluate(() => JSON.stringify(T().demo.program));
  const up2 = await page.locator('[data-act="max"][data-d="1"]').isEnabled();
  await page.click(`[data-act="max"][data-d="${up2 ? 1 : -1}"]`);
  const after = await page.evaluate(() => ({ gen: T().demo.generated, prog: JSON.stringify(T().demo.program) }));
  expect(after.gen).toBe(false);
  expect(after.prog).toBe(before);
});

test('New menu: Reset all goes back to the default setup after confirming', async ({ page }) => {
  await load(page, { ...demo, max: 5, program: [{ op: 'push', t: 'A', arg: { k: 'num', v: 9 } }] });
  await page.click('[data-act="run"]');
  page.once('dialog', dlg => dlg.accept());
  await page.click('[data-act="newmenu"]');
  await page.click('#menu [data-act="resetall"]');
  await expect(page.locator('.line')).toHaveCount(0);
  await expect(page.locator('.stepper output')).toHaveText('5');
  await expect(page.locator('[data-act="addline"]')).toBeEnabled();
});

test('starting contents and variables can be edited before Run, not while running', async ({ page }) => {
  await load(page, { ...demo, max: 5, structs: [{ name: 'A', type: 'stack', init: { arr: [5, null, null, null, null], size: 1, head: 0 } }] });
  const init = () => page.evaluate(() => ({ A: T().demo.structs[0].init, vars: initVars(T().demo) }));

  // add on top: the "+" slot, value 9
  await page.click('[data-act="cadd"][data-x="A"]');
  await page.click('#menu [data-act="cpick"]:text-is("9")');
  expect((await init()).A).toEqual({ arr: [5, 9, null, null, null], size: 2, head: 0 });

  // change the bottom item; 9 is in use so it is disabled; the bottom item has no Remove
  await page.click('[data-act="citem"][data-i="0"]');
  await expect(page.locator('#menu [data-act="cpick"]:text-is("9")')).toBeDisabled();
  await expect(page.locator('#menu [data-val="\\"del\\""]')).toHaveCount(0);
  await page.click('#menu [data-act="cpick"]:text-is("3")');
  expect((await init()).A.arr.slice(0, 2)).toEqual([3, 9]);

  // remove the top item (array view this time)
  await page.click('[data-act="view"][data-v="array"]');
  await page.click('button.c[data-act="citem"][data-i="1"]');
  await page.click('#menu [data-val="\\"del\\""]');
  expect((await init()).A).toEqual({ arr: [3, null, null, null, null], size: 1, head: 0 });

  // preset m = 7, then Push(A, m) runs without an error
  await page.click('[data-act="cvar"][data-v="m"]');
  await expect(page.locator('#menu [data-act="cpick"]:text-is("3")')).toBeDisabled();
  await page.click('#menu [data-act="cpick"]:text-is("7")');
  expect((await init()).vars.m).toBe(7);
  await page.evaluate(() => { T().demo.program = [{ op: 'push', t: 'A', arg: { k: 'var', n: 'm' } }]; update(null); });
  await page.click('[data-act="run"]');
  await expect(page.locator('.status')).not.toHaveClass(/err/);
  await expect(page.locator('[data-ref="cell:A:1"]')).toHaveText('7');

  // locked while running: no edit controls; Stop brings them back
  await expect(page.locator('[data-act="cadd"], [data-act="citem"], [data-act="cvar"], [data-act="cempty"]')).toHaveCount(0);
  await page.click('[data-act="stop"]');
  await expect(page.locator('[data-act="cempty"][data-x="A"]')).toBeEnabled();
  await page.click('[data-act="cempty"][data-x="A"]');
  expect((await init()).A.size).toBe(0);
});

test('editing contents regenerates an untouched random program', async ({ page }) => {
  await load(page, { ...demo, tab: 'queue', max: 6, names: { stack: 'XYZ', queue: 'XYZ' },
    structs: [{ name: 'X', type: 'queue', init: { arr: [null, null, null, null, 4, 8], size: 2, head: 4 } }] });
  await page.click('[data-act="view"][data-v="array"]');
  for (let rep = 0; rep < 10; rep++) {
    await page.evaluate(() => doRestart(true));
    for (const sel of ['[data-act="chead"][data-d="1"]', '[data-act="cempty"]', '[data-act="crand"]']) {
      if (!(await page.locator(sel).isEnabled())) continue;
      await page.click(sel);
      const r = await page.evaluate(() => ({ gen: T().demo.generated, err: buildTrace(T().demo).err }));
      expect(r.gen).toBe(true);
      expect(r.err).toBeNull();
    }
  }
});
