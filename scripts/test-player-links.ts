/**
 * Run: npm run test:playerlinks
 * Covers "my club's name shows up in my player list": a squad page has a link to the club itself
 * (team.asp?teamID=...) and the old parser saved it as a player.
 * The page-level tests need jsdom (a DOM); they are skipped with a note if it is not installed.
 */
import assert from 'node:assert/strict';
import { playerIdFromHref, isPlayerHref } from '../src/utils/playerLink';
import { sanitizeSquad, repairStoredSquad, isClubNotPlayer } from '../src/utils/sanitizeSquad';

let n = 0;
async function test(name: string, fn: () => void | Promise<void>) { await fn(); n++; console.log('  ok  ' + name); }
const store = (init: Record<string, string>) => ({ getItem: (k: string) => init[k] ?? null, setItem: (k: string, v: string) => { init[k] = v; }, data: init }) as any;

(async () => {
  await test('real player links give the player id', () => {
    assert.equal(playerIdFromHref('playerdetails.asp?playerID=10001'), '10001');
    assert.equal(playerIdFromHref('/nl/playerdetails.asp?playerid=42&x=1'), '42');
    assert.equal(playerIdFromHref('player.asp?player_id=77'), '77');
    assert.equal(playerIdFromHref('playerdetails.asp?id=123'), '123'); // bare id on a player page
  });
  await test('club, league, match, user and season links are NOT players', () => {
    for (const h of ['team.asp?teamID=555123', 'league.asp?leagueID=777', 'match.asp?matchID=9001', 'user.asp?userID=42',
                     'fixtures.asp?seasonid=12', 'club.asp?clubid=5', 'teamdetails.asp?id=8', '#', '', 'javascript:void(0)']) {
      assert.equal(isPlayerHref(h), false, h);
    }
    assert.equal(playerIdFromHref(null), undefined);
  });

  await test('a saved "player" named like the club is removed; real players are kept', () => {
    const saved = [{ id: '555123', name: 'HairyBeanBags' }, { id: '10001', name: 'Tom Archer', skills: { batting: 7 } }];
    assert.deepEqual(sanitizeSquad(saved, { teamName: 'HairyBeanBags' }).map((p) => p.name), ['Tom Archer']);
    assert.deepEqual(sanitizeSquad(saved, { teamName: 'hairybeanbags ' }).map((p) => p.name), ['Tom Archer'], 'case/space insensitive');
    assert.equal(sanitizeSquad(saved, {}).length, 2, 'no club name known -> nothing removed');
    assert.equal(sanitizeSquad(saved, { teamName: 'My Club' }).length, 2, 'placeholder club names are ignored');
    assert.equal(isClubNotPlayer('Tom Archer', 'HairyBeanBags'), false);
  });
  await test('startup repair cleans the already-saved squad', () => {
    const s = store({
      bt_team_name: 'HairyBeanBags',
      bt_squad: JSON.stringify([{ id: '555123', name: 'HairyBeanBags' }, { id: '10001', name: 'Tom Archer' }]),
    });
    assert.equal(repairStoredSquad(s), true);
    assert.deepEqual(JSON.parse(s.data.bt_squad).map((p: any) => p.name), ['Tom Archer']);
    assert.equal(repairStoredSquad(s), false, 'second run is a no-op');
  });

  // ---- page-level (needs a DOM) ----
  let JSDOM: any = null;
  try { JSDOM = (await import('jsdom')).JSDOM; } catch { /* optional */ }
  if (!JSDOM) {
    console.log('  --  page-level tests skipped (install jsdom to run them: npm i -D jsdom)');
  } else {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    const g: any = globalThis;
    const mem: Record<string, string> = {};
    for (const k of ['window', 'document', 'navigator', 'DOMParser', 'HTMLElement', 'Node', 'Event']) {
      try { Object.defineProperty(g, k, { value: (dom.window as any)[k], configurable: true, writable: true }); } catch {}
    }
    Object.defineProperty(g, 'localStorage', { value: { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } }, configurable: true, writable: true });
    const { parseBattrickPage } = await import('../src/parser');
    const { parseTransferList } = await import('../src/utils/transferList');
    // Real pages have whitespace/newlines between cells (the parser reads textContent), so the test page does too.
    const row = (id: string, name: string) =>
      `<tr>\n<td><a href="playerdetails.asp?playerID=${id}">${name}</a></td>\n<td>Age: 24</td>\n<td>Wage: £1,500</td>\n<td>Batting: good</td>\n<td>Bowling: poor</td>\n</tr>\n`;
    const page = (extra = '') => `<html><body><div id="header"><a href="team.asp?teamID=555123">HairyBeanBags</a> <a href="league.asp?leagueID=777">Premier League</a></div>${extra}<table>${row('10001', 'Tom Archer')}${row('10002', 'Sam Reid')}${row('10003', 'Joe Cole')}</table></body></html>`;

    await test('squad page: the club link in the header is not a player', () => {
      const r: any = parseBattrickPage(page(), 'squad');
      assert.deepEqual(r.players.map((p: any) => p.name).sort(), ['Joe Cole', 'Sam Reid', 'Tom Archer']);
      assert.ok(!r.players.some((p: any) => /HairyBeanBags|Premier League/.test(p.name)));
    });
    await test('squad page: match and manager links are not players either', () => {
      const r: any = parseBattrickPage(page('<a href="match.asp?matchID=9001">Last match</a><a href="user.asp?userID=42">Manager</a>'), 'squad');
      assert.equal(r.players.length, 3);
      assert.deepEqual(r.players.map((p: any) => p.id).sort(), ['10001', '10002', '10003']);
    });
    await test('squad page: player ids and names are still read correctly', () => {
      const r: any = parseBattrickPage(page(), 'squad');
      const tom = r.players.find((p: any) => p.id === '10001');
      assert.equal(tom.name, 'Tom Archer');
      assert.equal(tom.age, 24);
      assert.equal(tom.wage, 1500);
    });
    await test('transfer list: a team link is not a listing', () => {
      const html = `<table><tr><td><a href="team.asp?teamID=555123">HairyBeanBags</a></td></tr><tr><td><a href="playerdetails.asp?playerID=111">Real Player</a></td><td>Age: 24 Batting: 9 Asking Price: £50,000 Deadline: 20/11/2026 10:00</td></tr></table>`;
      const ids = parseTransferList(html).map((l) => l.playerId);
      assert.ok(!ids.includes('555123'), 'team link must not become a listing');
      assert.ok(ids.includes('111'));
    });
  }
  console.log(`\n${n} tests passed`);
  process.exit(0);
})();
