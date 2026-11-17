// Combat is stored in precise base units. Convert only at the display boundary;
// rounding a visible value must never discard banked or dealt fractional power.
export const combatNumber = (value: number) => Math.round(value * 100).toLocaleString('en-US');
