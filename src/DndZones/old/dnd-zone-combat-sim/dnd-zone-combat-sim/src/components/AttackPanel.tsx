import { Alert, Button, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import type { BattleState } from "../engine/types/battlefield";
import type { AttackMove, DamageType } from "../engine/types/equipment";
import { resolveAttack } from "../engine/rules/attackResolver";
import { humanoidBodyMap } from "../engine/data/bodyMaps";
import { useMemo, useState } from "react";
import type { AttackResult } from "../engine/types/combat";

interface AttackPanelProps {
  state: BattleState;
  setState: (state: BattleState) => void;
  attackerId?: string;
  defenderId?: string;
  onResult: (result: AttackResult) => void;
}

const attackMoves: AttackMove[] = ["slashHigh", "slashMid", "slashLow", "cleave", "stab"];
const damageTypes: DamageType[] = ["slash", "pierce", "blunt"];

export function AttackPanel({ state, setState, attackerId, defenderId, onResult }: AttackPanelProps) {
  const attacker = attackerId ? state.combatants[attackerId] : undefined;
  const defender = defenderId ? state.combatants[defenderId] : undefined;
  const [weaponId, setWeaponId] = useState("");
  const [move, setMove] = useState<AttackMove>("slashMid");
  const [damageType, setDamageType] = useState<DamageType>("slash");
  const [bodyPartId, setBodyPartId] = useState("chest");
  const [error, setError] = useState("");

  const selectedWeapon = useMemo(() => attacker?.equipment.weapons.find((weapon) => weapon.id === weaponId) ?? attacker?.equipment.weapons[0], [attacker, weaponId]);

  function handleAttack() {
    if (!attacker || !defender || !selectedWeapon) {
      setError("Select an attacker, defender, and weapon.");
      return;
    }
    try {
      const resolved = resolveAttack(state, {
        attackerId: attacker.id,
        defenderId: defender.id,
        weaponId: selectedWeapon.id,
        move,
        damageType,
        chosenBodyPartId: move === "stab" ? bodyPartId : undefined,
      });
      setState(resolved.state);
      onResult(resolved.result);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve attack.");
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Attack Resolver</Typography>
        <Typography variant="body2" color="text.secondary">
          Click one combatant for attacker, then another for defender. The engine rolls a marker, defender shifts it, then attacker corrects it.
        </Typography>
        <Typography variant="body2">Attacker: <strong>{attacker?.name ?? "None"}</strong></Typography>
        <Typography variant="body2">Defender: <strong>{defender?.name ?? "None"}</strong></Typography>

        <FormControl fullWidth size="small">
          <InputLabel>Weapon</InputLabel>
          <Select label="Weapon" value={selectedWeapon?.id ?? ""} onChange={(event: SelectChangeEvent) => setWeaponId(event.target.value)}>
            {attacker?.equipment.weapons.map((weapon) => <MenuItem key={weapon.id} value={weapon.id}>{weapon.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Attack Move</InputLabel>
          <Select label="Attack Move" value={move} onChange={(event: SelectChangeEvent) => setMove(event.target.value as AttackMove)}>
            {attackMoves.map((candidate) => <MenuItem key={candidate} value={candidate}>{candidate}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Damage Type</InputLabel>
          <Select label="Damage Type" value={damageType} onChange={(event: SelectChangeEvent) => setDamageType(event.target.value as DamageType)}>
            {damageTypes.map((candidate) => <MenuItem key={candidate} value={candidate}>{candidate}</MenuItem>)}
          </Select>
        </FormControl>

        {move === "stab" && (
          <FormControl fullWidth size="small">
            <InputLabel>Stab Target</InputLabel>
            <Select label="Stab Target" value={bodyPartId} onChange={(event: SelectChangeEvent) => setBodyPartId(event.target.value)}>
              {humanoidBodyMap.map((part) => <MenuItem key={part.id} value={part.id}>{part.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {error && <Alert severity="warning">{error}</Alert>}
        <Button variant="contained" onClick={handleAttack}>Resolve Attack</Button>
      </Stack>
    </Paper>
  );
}
