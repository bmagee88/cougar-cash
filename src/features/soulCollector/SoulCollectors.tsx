import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  List,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { BattleMessage, BattlePhase, Creature, Move, RollBandData } from "./types";
import { safeRandomId, chooseOne } from "./random";
import { generateCreature } from "./creatureGeneration";
import {
  applySkillUse,
  describeBand,
  getAttackMultiplier,
  getDefenseReduction,
  getEffectiveness,
  rollForTrait,
  rollGrowth,
} from "./battleMath";
import { runSelfTests } from "./selfTests";
import { StyledBattleText } from "./uiHelpers";
import { BattleTextBox } from "./components/BattleTextBox";
import { CreatureCard } from "./components/CreatureCard";
import { CreatureStatsDialog } from "./components/CreatureStatsDialog";
import { RollBandBar } from "./components/RollBandBar";
import { SmallCreatureRow } from "./components/SmallCreatureRow";

export default function SoulCollectorBattlePrototype() {
  const [wildCreatures, setWildCreatures] = useState<Creature[]>([]);
  const [necklace, setNecklace] = useState<Creature[]>([]);
  const [playerCreature, setPlayerCreature] = useState<Creature | null>(null);
  const [opponentCreature, setOpponentCreature] = useState<Creature | null>(null);
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [battleLog, setBattleLog] = useState<BattleMessage[]>([]);
  const [selectedSwitchId, setSelectedSwitchId] = useState("");
  const [statsCreature, setStatsCreature] = useState<Creature | null>(null);
  const [battleMessages, setBattleMessages] = useState<BattleMessage[]>([]);
  const [devMode, setDevMode] = useState(true);

  const necklaceHasSpace = necklace.length < 6;
  const battleReady = Boolean(playerCreature && opponentCreature);
  const selfTests = useMemo(() => runSelfTests(), []);

  const makeBattleMessage = (text: string, rollBar?: RollBandData): BattleMessage => ({ id: safeRandomId(), text, rollBar });

  const addLog = (message: string | BattleMessage) => {
    const entry = typeof message === "string" ? makeBattleMessage(message) : message;
    setBattleLog((prev) => [entry, ...prev].slice(0, 30));
  };

  const addBattleMessages = (messages: Array<string | BattleMessage>) => {
    const normalizedMessages = messages.map((message) => (typeof message === "string" ? makeBattleMessage(message) : message));
    normalizedMessages.forEach(addLog);
    setBattleMessages((prev) => [...prev, ...normalizedMessages]);
  };

  const advanceBattleMessage = () => setBattleMessages((prev) => prev.slice(1));

  const generateWildCreature = () => {
    const creature = generateCreature();
    setWildCreatures((prev) => [creature, ...prev]);
    addLog(`A wild ${creature.emoji} ${creature.name} appeared.`);
  };

  const moveWildToOpponent = (creature: Creature) => {
    setWildCreatures((prev) => prev.filter((item) => item.id !== creature.id));
    setOpponentCreature(creature);
    setPhase(playerCreature ? "menu" : "idle");
    addLog(`${creature.name} moved into the opponent slot.`);
  };

  const moveWildToNecklace = (creature: Creature) => {
    if (!necklaceHasSpace) {
      addLog("The soul necklace is full. Release a soul before collecting another.");
      return;
    }
    setWildCreatures((prev) => prev.filter((item) => item.id !== creature.id));
    setNecklace((prev) => [...prev, creature]);
    addLog(`${creature.name}'s soul was added to the necklace.`);
  };

  const moveNecklaceToPlayerSlot = (creature: Creature) => {
    setNecklace((prev) => prev.filter((item) => item.id !== creature.id));
    if (playerCreature) {
      setNecklace((prev) => [...prev, playerCreature]);
      addLog(`${playerCreature.name} returned to the soul necklace.`);
    }
    setPlayerCreature(creature);
    setPhase(opponentCreature ? "menu" : "idle");
    addLog(`${creature.name} entered your battle slot.`);
  };

  const releaseSoul = (creature: Creature) => {
    setNecklace((prev) => prev.filter((item) => item.id !== creature.id));
    addLog(`${creature.name}'s soul was released.`);
  };

  const runFromBattle = () => {
    if (!playerCreature) return;
    if (necklace.length < 6) {
      setNecklace((prev) => [...prev, playerCreature]);
      addLog(`${playerCreature.name} returned to the necklace. You ran from battle.`);
    } else {
      addLog(`${playerCreature.name} left the battle slot, but the necklace is full. The soul disperses.`);
    }
    setPlayerCreature(null);
    setPhase("idle");
  };

  const performAttack = (attacker: Creature, defender: Creature, move: Move) => {
    const attackSkill = attacker.hiddenSkills[move.skillUsed];
    const defenseSkill = defender.hiddenSkills[move.resistedBy];
    const usableAttackSkill = Math.floor(attackSkill?.current ?? 250);
    const usableDefenseSkill = Math.floor(defenseSkill?.current ?? 250);
    const attackTrait = attackSkill?.trait ?? "normal";
    const defenseTrait = defenseSkill?.trait ?? "normal";

    const attackRoll = rollForTrait(attackTrait);
    const attackEffectiveness = getEffectiveness(usableAttackSkill, attackRoll.roll);
    const attackMultiplier = getAttackMultiplier(attackEffectiveness);
    const defenseRoll = rollForTrait(defenseTrait);
    const defenseEffectiveness = defenseRoll.isImmune ? "Super Effective" : getEffectiveness(usableDefenseSkill, defenseRoll.roll);
    const defenseReduction = defenseRoll.isImmune ? 0 : getDefenseReduction(defenseEffectiveness);
    const rawDamage = Math.max(1, Math.floor(move.basePower * attackMultiplier));
    const damage = Math.max(0, Math.floor(rawDamage * defenseReduction));
    const didAttackSkillGrow = attackSkill ? rollGrowth(attackSkill) : false;
    const defendedSuccessfully = defenseRoll.isImmune || defenseEffectiveness !== "Not Effective";
    const didDefenseSkillGrow = defenseSkill && defendedSuccessfully ? rollGrowth(defenseSkill) : false;
    const updatedAttacker = applySkillUse(attacker, move.skillUsed, didAttackSkillGrow);
    const defenderAfterGrowth = defenseSkill ? applySkillUse(defender, move.resistedBy, Boolean(didDefenseSkillGrow)) : defender;
    const updatedDefender = { ...defenderAfterGrowth, hp: Math.max(0, defenderAfterGrowth.hp - damage) };

    const attackRollBar: RollBandData = { title: "Attack Roll", skillName: move.skillUsed, skillValue: usableAttackSkill, trait: attackTrait, roll: attackRoll.roll, note: attackRoll.note, effectiveness: attackEffectiveness };
    const defenseRollBar: RollBandData = { title: "Defense Roll", skillName: move.resistedBy, skillValue: usableDefenseSkill, trait: defenseTrait, roll: defenseRoll.roll, note: defenseRoll.note, effectiveness: defenseEffectiveness };

    const devMessages: BattleMessage[] = [
      makeBattleMessage(`${attacker.emoji} ${attacker.name} used ${move.name} on ${defender.emoji} ${defender.name}.`),
      makeBattleMessage(`ATTACK: ${move.skillUsed} was ${attackSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableAttackSkill}. ${describeBand(usableAttackSkill)} Trait: ${attackTrait}. Outcome: ${attackEffectiveness}. Base power ${move.basePower} × ${attackMultiplier} = ${rawDamage} raw damage.`, attackRollBar),
      makeBattleMessage(
        defenseRoll.isImmune
          ? `DEFENSE: ${move.resistedBy} was ${defenseSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableDefenseSkill}. Trait: ${defenseTrait}. Ace in the Hole gave immunity, so raw damage ${rawDamage} became 0 final damage.`
          : `DEFENSE: ${move.resistedBy} was ${defenseSkill?.current.toFixed(2) ?? "missing"}, so the battle value was ${usableDefenseSkill}. ${describeBand(usableDefenseSkill)} Trait: ${defenseTrait}. Outcome: ${defenseEffectiveness}. Raw damage ${rawDamage} × defense multiplier ${defenseReduction} = ${damage} final damage.`,
        defenseRollBar
      ),
      makeBattleMessage(`${defender.name} HP: ${defender.hp} -> ${updatedDefender.hp}.`),
      makeBattleMessage(didAttackSkillGrow ? `${attacker.name}'s ${move.skillUsed} improved after the attempt. New level display: ${updatedAttacker.level}.` : `${attacker.name}'s ${move.skillUsed} did not improve this time. New level display after decay: ${updatedAttacker.level}.`),
      makeBattleMessage(
        defendedSuccessfully
          ? didDefenseSkillGrow
            ? `${defender.name} successfully defended, so ${move.resistedBy} was eligible for growth and improved. New level display: ${updatedDefender.level}.`
            : `${defender.name} successfully defended, so ${move.resistedBy} was eligible for growth, but it did not improve. New level display after decay: ${updatedDefender.level}.`
          : `${defender.name} did not successfully defend, so ${move.resistedBy} was not eligible for growth.`
      ),
    ];

    const userMessages: BattleMessage[] = [
      makeBattleMessage(`${attacker.emoji} ${attacker.name} used ${move.name}!`),
      makeBattleMessage(defenseRoll.isImmune ? `${defender.emoji} ${defender.name} was immune!` : `It was ${attackEffectiveness}. ${defender.name} took ${damage} damage.`),
      makeBattleMessage(`${defender.name} HP: ${defender.hp} -> ${updatedDefender.hp}.`),
    ];

    const messages = devMode ? devMessages : userMessages;
    return { updatedAttacker, updatedDefender, messages };
  };

  const handlePlayerMove = (move: Move) => {
    if (!playerCreature || !opponentCreature) return;
    const playerResult = performAttack(playerCreature, opponentCreature, move);
    addBattleMessages(playerResult.messages);

    if (playerResult.updatedDefender.hp <= 0) {
      setPlayerCreature(playerResult.updatedAttacker);
      setOpponentCreature(null);
      setPhase("ended");
      addBattleMessages([`${opponentCreature.name} fainted.`]);
      return;
    }

    const opponentMove = chooseOne(playerResult.updatedDefender.moves);
    const opponentResult = performAttack(playerResult.updatedDefender, playerResult.updatedAttacker, opponentMove);
    addBattleMessages([`${playerResult.updatedDefender.name} chose ${opponentMove.name}.`, ...opponentResult.messages]);

    if (opponentResult.updatedDefender.hp <= 0) {
      addBattleMessages([`${playerCreature.name} fainted.`]);
      if (necklace.length > 0) {
        const nextCreature = necklace[0];
        setNecklace((prev) => prev.slice(1));
        setPlayerCreature(nextCreature);
        setOpponentCreature(opponentResult.updatedAttacker);
        setPhase("menu");
        addBattleMessages([`${nextCreature.name} was pulled from the necklace into battle.`]);
      } else {
        setPlayerCreature(null);
        setOpponentCreature(opponentResult.updatedAttacker);
        setPhase("ended");
        addBattleMessages(["You are out of creatures in your necklace."]);
      }
      return;
    }

    setPlayerCreature(opponentResult.updatedDefender);
    setOpponentCreature(opponentResult.updatedAttacker);
    setPhase("menu");
  };

  const confirmSwitch = () => {
    if (!selectedSwitchId || !playerCreature) return;
    const incoming = necklace.find((creature) => creature.id === selectedSwitchId);
    if (!incoming) return;
    setNecklace((prev) => [...prev.filter((creature) => creature.id !== selectedSwitchId), playerCreature]);
    setPlayerCreature(incoming);
    setSelectedSwitchId("");
    setPhase("menu");
    addLog(`${incoming.name} switched into battle.`);
  };

  const menuDisabled = !battleReady || phase === "ended";
  const battleStatus = useMemo(() => {
    if (!playerCreature && necklace.length === 0) return "You need a soul creature in your necklace or battle slot.";
    if (!playerCreature) return "Choose a creature from your necklace for your battle slot.";
    if (!opponentCreature) return "Choose a wild creature for the opponent slot.";
    if (phase === "ended") return "Battle ended.";
    return "Choose an action.";
  }, [playerCreature, opponentCreature, necklace.length, phase]);

  return (
    <Box sx={{ p: 2, maxWidth: 1300, mx: "auto" }}>
      <Stack spacing={2}>
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="h4" fontWeight={800}>Soul Collector Battle Prototype</Typography>
              <Typography color="text.secondary">Generate wild creatures, collect up to 6 soul stones, and battle with detailed hidden-stat rolls.</Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={2}>
              <FormControlLabel control={<Switch checked={devMode} onChange={(event) => setDevMode(event.target.checked)} />} label={devMode ? "Dev Mode" : "User Mode"} />
              <Button variant="contained" size="large" onClick={generateWildCreature}>Generate Wild Creature</Button>
            </Stack>
          </Stack>
        </Paper>

        {devMode && (
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Typography variant="subtitle1" fontWeight={800}>Calculation Check</Typography>
            <Typography variant="body2" color="text.secondary">Damage order: base power × attack effectiveness = raw damage, then raw damage × defense effectiveness = final damage.</Typography>
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {selfTests.map((test) => <Chip key={test.name} color={test.pass ? "success" : "error"} label={`${test.pass ? "PASS" : "FAIL"}: ${test.name}`} />)}
            </Stack>
          </Paper>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><CreatureCard title="Your Battle Slot" creature={playerCreature} onViewStats={setStatsCreature} devMode={devMode} /></Grid>
          <Grid item xs={12} md={6}><CreatureCard title="Opponent Slot" creature={opponentCreature} onViewStats={setStatsCreature} devMode={devMode} /></Grid>
        </Grid>

        <BattleTextBox messages={battleMessages} onAdvance={advanceBattleMessage} devMode={devMode} />

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom>Battle Menu</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>{battleStatus}</Typography>

          {phase !== "fight" && phase !== "switch" && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Button variant="contained" disabled={menuDisabled} onClick={() => setPhase("fight")}>Fight</Button>
              <Button variant="outlined" disabled={!playerCreature || necklace.length === 0} onClick={() => setPhase("switch")}>Switch</Button>
              <Button variant="outlined" disabled={!playerCreature} onClick={runFromBattle}>Run</Button>
              <Button variant="outlined" disabled={menuDisabled} onClick={() => { setPhase("item"); addLog("Items do nothing yet."); }}>Item</Button>
            </Stack>
          )}

          {phase === "fight" && playerCreature && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Choose a move</Typography>
              <Grid container spacing={1} sx={{ mt: 1 }}>
                {playerCreature.moves.map((move) => (
                  <Grid item xs={12} sm={6} md={3} key={move.id}>
                    <Button fullWidth variant="contained" onClick={() => handlePlayerMove(move)} sx={{ minHeight: 84, alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>
                      <Box>
                        <Typography fontWeight={800}>{move.name}</Typography>
                        <Typography variant="caption">Power {move.basePower}</Typography>
                      </Box>
                    </Button>
                  </Grid>
                ))}
              </Grid>
              <Button sx={{ mt: 1 }} onClick={() => setPhase("menu")}>Back</Button>
            </Box>
          )}

          {phase === "switch" && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Choose a soul to switch in</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} sx={{ mt: 1 }}>
                <Select value={selectedSwitchId} displayEmpty onChange={(event) => setSelectedSwitchId(event.target.value)} sx={{ minWidth: 280 }}>
                  <MenuItem value="" disabled>Select creature</MenuItem>
                  {necklace.map((creature) => <MenuItem key={creature.id} value={creature.id}>{creature.emoji} {creature.name} | {creature.level}</MenuItem>)}
                </Select>
                <Button variant="contained" disabled={!selectedSwitchId} onClick={confirmSwitch}>Confirm Switch</Button>
                <Button onClick={() => setPhase("menu")}>Cancel</Button>
              </Stack>
            </Box>
          )}
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Soul Necklace</Typography>
                <Chip label={`${necklace.length}/6 soul stones`} />
              </Stack>
              <Divider sx={{ my: 1 }} />

              {necklace.length === 0 ? (
                <Typography color="text.secondary">No souls collected yet.</Typography>
              ) : (
                <List dense>
                  {necklace.map((creature) => (
                    <SmallCreatureRow
                      key={creature.id}
                      creature={creature}
                      onViewStats={setStatsCreature}
                      devMode={devMode}
                      actions={
                        <>
                          <Button size="small" onClick={() => moveNecklaceToPlayerSlot(creature)}>Use</Button>
                          <Button size="small" color="error" onClick={() => releaseSoul(creature)}>Release</Button>
                        </>
                      }
                    />
                  ))}
                </List>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="h6">Wild Creatures</Typography>
              <Divider sx={{ my: 1 }} />

              {wildCreatures.length === 0 ? (
                <Typography color="text.secondary">No wild creatures generated.</Typography>
              ) : (
                <List dense>
                  {wildCreatures.map((creature) => (
                    <SmallCreatureRow
                      key={creature.id}
                      creature={creature}
                      onViewStats={setStatsCreature}
                      devMode={devMode}
                      actions={
                        <>
                          <Button size="small" onClick={() => moveWildToOpponent(creature)}>Battle</Button>
                          <Button size="small" disabled={!necklaceHasSpace} onClick={() => moveWildToNecklace(creature)}>Collect</Button>
                        </>
                      }
                    />
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6">Battle Log</Typography>
          <Divider sx={{ my: 1 }} />

          {battleLog.length === 0 ? (
            <Typography color="text.secondary">No events yet.</Typography>
          ) : (
            <Stack spacing={1}>
              {battleLog.map((entry) => (
                <Box key={entry.id} sx={{ borderBottom: "1px solid", borderColor: "divider", pb: 1 }}>
                  <Typography variant="body2">• <StyledBattleText text={entry.text} /></Typography>
                  {entry.rollBar && <RollBandBar data={entry.rollBar} />}
                </Box>
              ))}
            </Stack>
          )}
        </Paper>
      </Stack>

      <CreatureStatsDialog creature={statsCreature} onClose={() => setStatsCreature(null)} />
    </Box>
  );
}
