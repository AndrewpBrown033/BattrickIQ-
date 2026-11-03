/**
 * Net (coaching session) maths that is documented in the community sources and Battrick's own rules page.
 *
 * SOURCES: Battrick Rules, "Nets" section (www.battrick.org/nl/rules.asp?item=9), Battrickipedia "Training" and
 * "Staff" pages (wombatnet.com/bthf, whamgip.co.uk/battrickipedia), Battrick Helpfile (Feb 2012). Battrickipedia
 * says it is not affiliated with Battrick. NOTE: the wiki records that multi-net behaviour and training speeds
 * were changed around Season 57; the multiplier rule below is the documented one, but the exact current speeds
 * could not be read, so treat the numbers as community estimates.
 */

/** Battrick allows 10 coaching sessions a week in total. */
export const MAX_NETS_PER_WEEK = 10;

/**
 * Total "skill nets received" when one player gets n nets of the SAME primary skill: each extra net is half as
 * effective as the one before (100%, 50%, 25%, 12.5% ...), so 1, 1.5, 1.75, 1.875, 1.9375 ... (Battrickipedia
 * Staff table). Battrick's rules: a third session gives even less and a fourth "only negligible benefit".
 */
export function netMultiplier(n: number): number {
  if (!(n > 0)) return 0;
  const k = Math.min(Math.floor(n), MAX_NETS_PER_WEEK);
  return 2 - Math.pow(0.5, k - 1);
}

/** Rows for display: net count, this net's effectiveness, total received. */
export function netEffectivenessRows(count = 4): { net: number; effectiveness: number; total: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    net: i + 1,
    effectiveness: Math.pow(0.5, i),
    total: netMultiplier(i + 1),
  }));
}

/**
 * Stamina is published as whole-number weeks for ages 17-32: 6 weeks with 1 net, 4 with 2, 3 with 3
 * (Battrickipedia). That is 1x, 1.5x, 2x, not the 1.75x the primary-skill rule gives for a third net.
 */
export function staminaMultiplier(n: number): number {
  if (!(n > 0)) return 0;
  if (n <= 1) return 1;
  if (n < 3) return 1.5;
  if (n < 4) return 2;
  return 2 * (netMultiplier(n) / netMultiplier(3)); // beyond the published table: keep the diminishing shape
}
