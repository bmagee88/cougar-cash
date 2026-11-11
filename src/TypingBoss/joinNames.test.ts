import { generateJoinName, shortJoinCode } from "./joinNames";

declare const test: any, expect: any, jest: any;

test("generated aliases are short and shuffling never repeats the current name", () => {
  const random = jest.spyOn(Math, "random");
  try {
    const names = new Set<string>();
    for (let index = 0; index < 256; index += 1) {
      random.mockReturnValue((index + 0.5) / 256);
      const name = generateJoinName();
      expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
      expect(name.length).toBeLessThanOrEqual(9);
      names.add(name);
      expect(generateJoinName(name)).not.toBe(name);
    }
    expect(names.size).toBe(256);
  } finally { random.mockRestore(); }
});

test("display and copy codes omit the boss prefix and preserve leading zeros", () => {
  expect(shortJoinCode("boss0AF")).toBe("0AF");
  expect(shortJoinCode("BOSSabc")).toBe("ABC");
  expect(shortJoinCode("012")).toBe("012");
});
