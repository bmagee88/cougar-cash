const {
  HABITATS,
  LURES,
  COLORS,
  RETRIEVES,
  BATTLE_ESCAPE_POSITION,
  BATTLE_START_POSITION,
  chooseHabitatFromCell,
  calculateNibble,
  createBattleState,
  createRng,
  fullFishCard,
  generateFishPopulation,
  generateLake,
  generateMood,
  publicFishCard,
  resolveBattleStep,
  resolveBiteBox,
  resolveNibbleRoll,
} = require("./patternCore");

describe("The Pattern core rules", () => {
  test("generates exactly 20 fish per habitat with the required weight tiers", () => {
    const fish = generateFishPopulation(createRng("population"));

    for (const habitat of HABITATS) {
      const habitatFish = fish.filter((item) => item.habitat === habitat);
      expect(habitatFish).toHaveLength(20);
      expect(habitatFish.filter((item) => item.weightTier === "small")).toHaveLength(6);
      expect(habitatFish.filter((item) => item.weightTier === "keeper")).toHaveLength(6);
      expect(habitatFish.filter((item) => item.weightTier === "quality")).toHaveLength(4);
      expect(habitatFish.filter((item) => item.weightTier === "trophy")).toHaveLength(3);
      expect(habitatFish.filter((item) => item.weightTier === "lunker")).toHaveLength(1);
    }
  });

  test("tells always contain the innate profile without exposing singleton categories", () => {
    const fish = generateFishPopulation(createRng("truthful-tells"));

    fish.forEach((item) => {
      expect(item.tell.lures).toContain(item.innateProfile.lure);
      expect(item.tell.colors).toContain(item.innateProfile.color);
      expect(item.tell.retrieves).toContain(item.innateProfile.retrieve);
      expect(item.tell.lures.length).toBeGreaterThanOrEqual(2);
      expect(item.tell.colors.length).toBeGreaterThanOrEqual(2);
      expect(item.tell.retrieves.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("fight ratings obey weight-tier bounds", () => {
    const fish = generateFishPopulation(createRng("fight-bounds"));
    const minimums = { small: 2, keeper: 3, quality: 4, trophy: 5, lunker: 5 };

    fish.forEach((item) => {
      expect(item.fight).toBeGreaterThanOrEqual(minimums[item.weightTier]);
      expect(item.fight).toBeLessThanOrEqual(6);
    });
  });

  test("lake generation selects unique templates and rotates the top row", () => {
    const lake = generateLake(4, createRng("lake"));
    const templateIds = new Set(lake.tiles.map((tile) => tile.templateId));

    expect(lake.tiles).toHaveLength(8);
    expect(templateIds.size).toBe(8);
    expect(lake.tiles.filter((tile) => tile.row === 0).every((tile) => tile.rotation === 180)).toBe(true);
    expect(lake.tiles.filter((tile) => tile.row === 1).every((tile) => tile.rotation === 0)).toBe(true);
  });

  test("weighted habitat selection respects repeated icons", () => {
    const rng = createRng("weighted-cell");
    const counts = { V: 0, W: 0 };

    for (let index = 0; index < 3000; index += 1) {
      const result = chooseHabitatFromCell(["V", "V", "W"], rng);
      counts[result.habitat] += 1;
    }

    expect(counts.V).toBeGreaterThan(counts.W * 1.7);
    expect(counts.V).toBeLessThan(counts.W * 2.5);
  });

  test("mood additions preserve innate preferences and add only non-innate options", () => {
    const fish = generateFishPopulation(createRng("mood-fish"))[0];

    const lureMood = generateMood(fish, createRng("lure-mood"), "lure");
    expect(lureMood.hiddenMoodOptions.lures).toHaveLength(2);
    expect(new Set(lureMood.hiddenMoodOptions.lures).size).toBe(2);
    expect(lureMood.hiddenMoodOptions.lures).not.toContain(fish.innateProfile.lure);

    const colorMood = generateMood(fish, createRng("color-mood"), "color");
    expect(colorMood.hiddenMoodOptions.colors).toHaveLength(1);
    expect(colorMood.hiddenMoodOptions.colors).not.toContain(fish.innateProfile.color);

    const retrieveMood = generateMood(fish, createRng("retrieve-mood"), "retrieve");
    expect(retrieveMood.hiddenMoodOptions.retrieves).toHaveLength(1);
    expect(retrieveMood.hiddenMoodOptions.retrieves).not.toContain(fish.innateProfile.retrieve);
  });

  test("hot hit only comes from a mood-added non-innate match and bite box leaks no category result", () => {
    const fish = {
      innateProfile: {
        lure: "Jig",
        color: "Dark",
        retrieve: "Slow",
      },
    };
    const mood = {
      moodCategory: "lure",
      hiddenMoodOptions: {
        lures: ["Frog", "Worm"],
      },
    };

    const hot = resolveBiteBox(fish, mood, {
      lure: "Frog",
      color: "Dark",
      retrieve: "Fast",
    });
    expect(hot).toEqual({ matchCount: 2, hotHit: true });
    expect(Object.keys(hot).sort()).toEqual(["hotHit", "matchCount"]);

    const innate = resolveBiteBox(fish, mood, {
      lure: "Jig",
      color: "Dark",
      retrieve: "Fast",
    });
    expect(innate).toEqual({ matchCount: 2, hotHit: false });
  });

  test("nibble target stays tied to match count while modifiers apply to the roll", () => {
    const neutral = calculateNibble({
      matchCount: 1,
      hotHit: false,
      lure: "Frog",
      color: "Dark",
      retrieve: "Steady",
      habitat: "R",
      alert: false,
      weather: "No Weather",
      season: "No Season",
      line: "Braid",
      tackle: [],
    });
    expect(neutral.target).toBe(4);
    expect(neutral.modifier).toBe(0);

    const boosted = calculateNibble({
      matchCount: 1,
      hotHit: true,
      lure: "Frog",
      color: "Dark",
      retrieve: "Steady",
      habitat: "R",
      alert: false,
      weather: "No Weather",
      season: "No Season",
      line: "Braid",
      tackle: [],
      activeEvent: { key: "feedingWindow" },
    });
    expect(boosted.target).toBe(4);
    expect(boosted.modifier).toBe(2);
    expect(resolveNibbleRoll(2, boosted)).toMatchObject({
      modifiedRoll: 4,
      success: true,
    });
    expect(resolveNibbleRoll(1, boosted)).toMatchObject({
      modifiedRoll: 3,
      success: false,
    });
  });

  test("battle abilities trigger once, pressure failure moves 2, and Give Line suppresses Dive", () => {
    const fish = { id: "fish", fight: 6, ability: "dive" };
    const pressureBattle = createBattleState({ fishId: fish.id, playerId: "angler" });
    expect(pressureBattle.position).toBe(BATTLE_START_POSITION);
    const pressure = resolveBattleStep({
      fish,
      battle: pressureBattle,
      action: "pressure",
      roll: 1,
      cell: ["D"],
      equipment: {},
    });

    expect(pressure.step.movement).toBe(2);
    expect(pressure.battle.tangled).toBe(true);
    expect(pressure.battle.abilityUsed).toBe(true);

    const giveLineBattle = {
      ...createBattleState({ fishId: fish.id, playerId: "angler" }),
      position: 4,
    };
    const giveLine = resolveBattleStep({
      fish,
      battle: giveLineBattle,
      action: "giveLine",
      roll: null,
      cell: ["D"],
      equipment: {},
    });

    expect(giveLine.battle.position).toBe(5);
    expect(giveLine.battle.tangled).toBe(false);
    expect(giveLine.battle.abilityUsed).toBe(false);
  });

  test("battle track uses 7 numbered spaces before escaped", () => {
    const fish = { id: "fish", fight: 6, ability: "run" };
    const battle = {
      ...createBattleState({ fishId: fish.id, playerId: "angler" }),
      position: 7,
    };
    const result = resolveBattleStep({
      fish,
      battle,
      action: "giveLine",
      roll: null,
      cell: ["O"],
      equipment: {},
    });

    expect(BATTLE_START_POSITION).toBe(4);
    expect(BATTLE_ESCAPE_POSITION).toBe(8);
    expect(result.battle.position).toBe(BATTLE_ESCAPE_POSITION);
    expect(result.battle.terminal).toBe("escaped");
  });

  test("public fish cards redact hidden profile, weight, and unrevealed fight", () => {
    const fish = generateFishPopulation(createRng("redaction"))[0];
    fish.publicId = "fishPUBLIC";
    fish.guessHistory = [
      {
        id: "attempt-1",
        playerId: "angler1",
        playerName: "Angler",
        round: 2,
        declaration: { lure: "Jig", color: "Dark", retrieve: "Slow" },
        matchCount: 2,
        hotHit: false,
        nibbleRoll: 3,
        nibbleModifier: 1,
        nibbleTarget: 3,
        nibbleSuccess: true,
      },
    ];
    const card = publicFishCard(fish);

    expect(card.publicId).toBe("fishPUBLIC");
    expect(card.weight).toBeUndefined();
    expect(card.innateProfile).toBeUndefined();
    expect(card.fight).toBeNull();
    expect(card.ability).toBeNull();
    expect(card.guessHistory).toHaveLength(1);
    expect(card.guessHistory[0].matchCount).toBe(2);

    fish.fightRevealed = true;
    const revealed = publicFishCard(fish);
    expect(revealed.fight).toBe(fish.fight);
    expect(revealed.ability).toBe(fish.ability);
    expect(revealed.weight).toBeUndefined();
    expect(revealed.innateProfile).toBeUndefined();

    const full = fullFishCard(fish);
    expect(full.guessHistory[0].declaration).toEqual({
      lure: "Jig",
      color: "Dark",
      retrieve: "Slow",
    });
  });

  test("basic choice lists stay exact", () => {
    expect(LURES).toEqual(["Frog", "Jig", "Worm", "Crankbait", "Spinnerbait", "Swimbait"]);
    expect(COLORS).toEqual(["Natural", "Dark", "Bright", "Flash"]);
    expect(RETRIEVES).toEqual(["Slow", "Steady", "Erratic", "Fast"]);
  });
});
