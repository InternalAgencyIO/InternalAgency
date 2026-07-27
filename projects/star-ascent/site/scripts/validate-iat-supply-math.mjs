#!/usr/bin/env node

const supply = 1_000_000_000n;
const decimals = 9n;
const baseUnitSupply = supply * (10n ** decimals);
const allocations = {
  community: 50n,
  treasury: 20n,
  ecosystem: 15n,
  coreTeam: 10n,
  liquidity: 5n,
};

let total = 0n;
console.log(`IAT display supply: ${supply.toString()}`);
console.log(`IAT decimals: ${decimals.toString()}`);
console.log(`IAT base-unit supply: ${baseUnitSupply.toString()}`);
for (const [name, percent] of Object.entries(allocations)) {
  const displayAmount = (supply * percent) / 100n;
  const baseAmount = (baseUnitSupply * percent) / 100n;
  total += baseAmount;
  console.log(`${name}: ${percent.toString()}% | ${displayAmount.toString()} IAT | ${baseAmount.toString()} base units`);
}

if (total !== baseUnitSupply) {
  console.error(`FAIL: allocation total ${total.toString()} does not equal base-unit supply`);
  process.exitCode = 1;
} else {
  console.log("OK: all allocation base-unit amounts sum exactly to the fixed supply.");
}
