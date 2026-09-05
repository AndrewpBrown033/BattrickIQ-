export function getNumericSkillFromEstimate(estString: string): number {
  if (estString.includes('16+')) return 16;
  if (estString.includes('15')) return 15;
  if (estString.includes('14')) return 14;
  if (estString.includes('13')) return 13;
  if (estString.includes('12')) return 12;
  if (estString.includes('11')) return 11;
  if (estString.includes('10')) return 10;
  if (estString.includes('8-9')) return 8.5;
  if (estString.includes('7')) return 7;
  if (estString.includes('6')) return 6;
  return 1;
}
