export const DAY = 86_400_000;
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const LEVELS = ['Friendly numbers', 'Larger numbers', 'Decimals'];
export const SKILLS = {
  divide3: { name: 'Divide by 3', op: '÷', factor: 3 },
  divide5: { name: 'Divide by 5', op: '÷', factor: 5 },
  multiply25: { name: 'Multiply by 25', op: '×', factor: 25 },
  divide15: { name: 'Divide by 1.5', op: '÷', factor: 1.5 },
  divide12: { name: 'Divide by 1.2', op: '÷', factor: 1.2 },
  divide4: { name: 'Divide by 4', op: '÷', factor: 4 },
  multiply5: { name: 'Multiply by 5', op: '×', factor: 5 },
  divide8: { name: 'Divide by 8', op: '÷', factor: 8 },
  multiply15decimal: { name: 'Multiply by 1.5', op: '×', factor: 1.5 },
  multiply12decimal: { name: 'Multiply by 1.2', op: '×', factor: 1.2 },
  divide25: { name: 'Divide by 25', op: '÷', factor: 25 },
  multiply15: { name: 'Multiply by 15', op: '×', factor: 15 },
  multiply125: { name: 'Multiply by 125', op: '×', factor: 125 },
  percent5: { name: 'Find 5%', op: '%', factor: 5, denominator: 20 },
  percent15: { name: 'Find 15%', op: '%', factor: 15, denominator: 20 },
  percent125: { name: 'Find 12.5%', op: '%', factor: 12.5, denominator: 8 },
  percent20: { name: 'Find 20%', op: '%', factor: 20, denominator: 5 },
  percent25: { name: 'Find 25%', op: '%', factor: 25, denominator: 4 },
  percent10: { name: 'Find 10%', op: '%', factor: 10, denominator: 10 },
  percent50: { name: 'Find 50%', op: '%', factor: 50, denominator: 2 },
  divide6: { name: 'Divide by 6', op: '÷', factor: 6 },
  multiply9: { name: 'Multiply by 9', op: '×', factor: 9 },
  multiply11: { name: 'Multiply by 11', op: '×', factor: 11 },
  divideHalf: { name: 'Divide by 0.5', op: '÷', factor: 0.5 },
  divideQuarter: { name: 'Divide by 0.25', op: '÷', factor: 0.25 },
  percent75: { name: 'Find 75%', op: '%', factor: 75, denominator: 4 },
  increase10: { name: 'Increase by 10%', op: '%', factor: 10, denominator: 10, adjustment: 1 },
  decrease10: { name: 'Decrease by 10%', op: '%', factor: 10, denominator: 10, adjustment: -1 },
  increase20: { name: 'Increase by 20%', op: '%', factor: 20, denominator: 5, adjustment: 1 },
  decrease20: { name: 'Decrease by 20%', op: '%', factor: 20, denominator: 5, adjustment: -1 },
  increase25: { name: 'Increase by 25%', op: '%', factor: 25, denominator: 4, adjustment: 1 },
  decrease25: { name: 'Decrease by 25%', op: '%', factor: 25, denominator: 4, adjustment: -1 },
};
export const format = n => String(Math.round(n * 10000) / 10000);
export const categoryOf = skill => ({ '÷': 'division', '×': 'multiplication', '%': 'percentages' })[SKILLS[skill]?.op];
export function selectSkills(skill = 'all', skills) {
  if (skills !== undefined) {
    if (!Array.isArray(skills) || !skills.length || skills.length > Object.keys(SKILLS).length || skills.some(id => typeof id !== 'string' || !Object.hasOwn(SKILLS, id))) throw new Error('Choose at least one valid skill.');
    return [...new Set(skills)];
  }
  if (skill === 'all') return Object.keys(SKILLS);
  if (['division', 'multiplication', 'percentages'].includes(skill)) return Object.keys(SKILLS).filter(id => categoryOf(id) === skill);
  if (typeof skill === 'string' && Object.hasOwn(SKILLS, skill)) return [skill];
  throw new Error('Unknown practice selection.');
}
export function makeQuestion(skill, level, random = Math.random) {
  if (!SKILLS[skill] || !Number.isInteger(level) || level < 0 || level > 2) throw new Error('Invalid skill or level');
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const { name, op, factor, denominator, adjustment } = SKILLS[skill];
  let base = level === 0 ? int(2, 20) : int(21, 180);
  if (level === 2) {
    base = int(11, 399) / 10;
    if (Number.isInteger(base)) base += 0.1;
  }
  if (level === 0 && skill === 'divide15') base = int(1, 10) * 2;
  if (level === 0 && skill === 'divide12') base = int(1, 10) * 5;
  if (level === 0 && skill === 'multiply15decimal') base = int(1, 10) * 2;
  if (level === 0 && skill === 'multiply12decimal') base = int(1, 10) * 5;
  if (level === 0 && skill === 'multiply125') base = int(1, 10) * 8;
  if (level === 0 && skill === 'divideHalf') base = int(2, 20) * 2;
  if (level === 0 && skill === 'divideQuarter') base = int(2, 20) * 4;
  const operand = op === '÷' ? base * factor : op === '%' && level < 2 ? base * denominator : base;
  const portion = operand * factor / 100;
  const result = adjustment ? operand + adjustment * portion : op === '÷' ? base : op === '%' ? portion : base * factor;
  const n = format(operand), a = format(result), f = format;
  const tens = Math.floor(result / 10) * 10;
  const methods = {
    divide3: ['Split into easy multiples of 3.', tens > 0 && result !== tens ? `${n} = ${f(tens * 3)} + ${f(operand - tens * 3)}; divide each by 3: ${tens} + ${f(result - tens)} = ${a}` : `3 × ${a} = ${n}, so ${n} ÷ 3 = ${a}`],
    divide5: ['Double, then divide by 10.', `${n} × 2 = ${f(operand * 2)}; ${f(operand * 2)} ÷ 10 = ${a}`],
    multiply25: ['Multiply by 100, then halve twice.', `${n} × 100 = ${f(operand * 100)}; half is ${f(operand * 50)}; half again is ${a}`],
    divide15: ['Double, then divide by 3.', `${n} × 2 = ${f(operand * 2)}; ${f(operand * 2)} ÷ 3 = ${a}`],
    divide12: ['Multiply by 10, then divide by 4 and by 3—in either order.', `${n} × 10 = ${f(operand * 10)}; ${f(operand * 10)} ÷ 4 = ${f(operand * 2.5)}; ${f(operand * 2.5)} ÷ 3 = ${a}`],
    divide4: ['Halve twice.', `Half of ${n} is ${f(operand / 2)}; half again is ${a}`],
    multiply5: ['Multiply by 10, then halve.', `${n} × 10 = ${f(operand * 10)}; half is ${a}`],
    divide8: ['Halve three times.', `${n} → ${f(operand / 2)} → ${f(operand / 4)} → ${a}`],
    multiply15decimal: ['Add half the number.', `Half of ${n} is ${f(operand / 2)}; ${n} + ${f(operand / 2)} = ${a}`],
    multiply12decimal: ['Add 20% of the number.', `20% of ${n} = ${n} ÷ 5 = ${f(operand / 5)}; ${n} + ${f(operand / 5)} = ${a}`],
    divide25: ['Multiply by 4, then divide by 100.', `${n} × 4 = ${f(operand * 4)}; ${f(operand * 4)} ÷ 100 = ${a}`],
    multiply15: ['Multiply by 10, then add half that result.', `${n} × 10 = ${f(operand * 10)}; half is ${f(operand * 5)}; ${f(operand * 10)} + ${f(operand * 5)} = ${a}`],
    multiply125: ['Multiply by 1,000, then halve three times.', `${n} × 1,000 = ${f(operand * 1000)}; halve: ${f(operand * 500)} → ${f(operand * 250)} → ${a}`],
    percent5: ['Find 10%, then halve it.', `10% of ${n} = ${f(operand / 10)}; half is ${a}`],
    percent15: ['Add 10% and 5%.', `10% = ${f(operand / 10)}; 5% = ${f(operand / 20)}; ${f(operand / 10)} + ${f(operand / 20)} = ${a}`],
    percent125: ['12.5% is one eighth: halve three times.', `${n} → ${f(operand / 2)} → ${f(operand / 4)} → ${a}`],
    percent20: ['20% is one fifth: divide by 5.', `Double ${n} to get ${f(operand * 2)}; ${f(operand * 2)} ÷ 10 = ${a}`],
    percent25: ['25% is one quarter: halve twice.', `${n} → ${f(operand / 2)} → ${a}`],
    percent10: ['Divide by 10.', `${n} ÷ 10 = ${a}`],
    percent50: ['50% is one half: halve the number.', `${n} ÷ 2 = ${a}`],
    divide6: ['Divide by 3, then halve—or halve, then divide by 3.', `${n} ÷ 3 = ${f(operand / 3)}; ${f(operand / 3)} ÷ 2 = ${a}`],
    multiply9: ['Multiply by 10, then subtract the original number.', `${n} × 10 = ${f(operand * 10)}; ${f(operand * 10)} − ${n} = ${a}`],
    multiply11: ['Multiply by 10, then add the original number.', `${n} × 10 = ${f(operand * 10)}; ${f(operand * 10)} + ${n} = ${a}`],
    divideHalf: ['Dividing by one half doubles the number.', `${n} × 2 = ${a}`],
    divideQuarter: ['Dividing by one quarter multiplies the number by 4.', `Double ${n} to get ${f(operand * 2)}; double again to get ${a}`],
    percent75: ['Find one quarter, then subtract it from the whole.', `25% of ${n} = ${f(operand / 4)}; ${n} − ${f(operand / 4)} = ${a}`],
  };
  const [method, steps] = adjustment ? [
    `Find ${factor}%, then ${adjustment > 0 ? 'add it to' : 'subtract it from'} the original number.`,
    `${factor}% of ${n} = ${n} ÷ ${denominator} = ${f(portion)}; ${n} ${adjustment > 0 ? '+' : '−'} ${f(portion)} = ${a}`,
  ] : methods[skill];
  const prompt = adjustment ? `${adjustment > 0 ? 'Increase' : 'Decrease'} ${n} by ${factor}%` : op === '%' ? `${factor}% of ${n}` : `${n} ${op} ${factor}`;
  return { skill, level, label: name, operand: n, prompt, answer: a, method, steps };
}

// One growth step per UTC day prevents same-day drilling from inflating retention.
// Difficulty unlocks separately; older bands remain scheduled for review.
export function schedule(previous, rating, now) {
  const state = { ...previous };
  const today = Math.floor(now / DAY), newDay = state.last_day !== today;
  if (rating === 'missed') {
    Object.assign(state, { step: -1, due: now + 300_000, comfortable_days: 0 });
  } else if (rating === 'slow') {
    Object.assign(state, { step: Math.max(-1, state.step - 1), due: now + DAY, comfortable_days: 0 });
  } else if (rating === 'comfortable') {
    if (newDay) {
      state.step = Math.min(state.step + 1, INTERVALS.length - 1);
      state.comfortable_days += 1;
      state.due = now + INTERVALS[Math.max(0, state.step)] * DAY;
    } else if (state.due <= now || state.step === -1) {
      // A successful short retry closes the lapse without advancing mastery.
      state.due = now + DAY;
    }
  } else throw new Error('Unknown rating');
  state.last_day = today;
  state.attempts += 1;
  return state;
}
