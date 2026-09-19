export const DAY = 86_400_000;
export const INTERVALS = [1, 3, 7, 14, 30, 60];
export const LEVELS = ['Friendly numbers', 'Larger numbers', 'Decimals'];
export const SKILLS = {
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
};
export const format = n => String(Math.round(n * 10000) / 10000);
export function makeQuestion(skill, level, random = Math.random) {
  if (!SKILLS[skill] || !Number.isInteger(level) || level < 0 || level > 2) throw new Error('Invalid skill or level');
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const { name, op, factor, denominator } = SKILLS[skill];
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
  const operand = op === '÷' ? base * factor : op === '%' && level < 2 ? base * denominator : base;
  const result = op === '÷' ? base : op === '%' ? operand * factor / 100 : base * factor;
  const n = format(operand), a = format(result), f = format;
  const methods = {
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
  };
  return { skill, level, label: name, operand: n, prompt: op === '%' ? `${factor}% of ${n}` : `${n} ${op} ${factor}`, answer: a, method: methods[skill][0], steps: methods[skill][1] };
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
