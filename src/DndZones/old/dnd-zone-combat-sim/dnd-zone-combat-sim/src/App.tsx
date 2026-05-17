import { CssBaseline, Box, Container, Stack, ThemeProvider, Typography, createTheme } from "@mui/material";
import { useMemo, useState } from "react";
import { initialBattleState } from "./engine/data/sampleBattlefield";
import type { BattleState } from "./engine/types/battlefield";
import type { AttackResult } from "./engine/types/combat";
import { BattlefieldView } from "./components/BattlefieldView";
import { GroupInterior } from "./components/GroupInterior";
import { AttackPanel } from "./components/AttackPanel";
import { BodyCoverageView } from "./components/BodyCoverageView";
import { CombatLog } from "./components/CombatLog";

const theme = createTheme({
  palette: {
    mode: "dark",
  },
  shape: {
    borderRadius: 12,
  },
});

export default function App() {
  const [battleState, setBattleState] = useState<BattleState>(initialBattleState);
  const [selectedGroupId, setSelectedGroupId] = useState(initialBattleState.groups[0].id);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | undefined>("hero1");
  const [selectedDefenderId, setSelectedDefenderId] = useState<string | undefined>("enemy1");
  const [lastResult, setLastResult] = useState<AttackResult | undefined>();

  const selectedGroup = useMemo(
    () => battleState.groups.find((group) => group.id === selectedGroupId) ?? battleState.groups[0],
    [battleState.groups, selectedGroupId],
  );

  function handleSelectCombatant(id: string) {
    if (!selectedAttackerId || selectedAttackerId === id) {
      setSelectedAttackerId(id);
      setLastResult(undefined);
      return;
    }
    setSelectedDefenderId(id);
    setLastResult(undefined);
  }

  const defender = selectedDefenderId ? battleState.combatants[selectedDefenderId] : undefined;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>DND Zone Combat Simulator</Typography>
            <Typography variant="body1" color="text.secondary">
              Zone-based rows, reach-based melee, exact body coverage, armor mitigation, weapon attunement, and Fight instead of HP.
            </Typography>
          </Box>

          <BattlefieldView state={battleState} selectedGroupId={selectedGroupId} onSelectGroup={setSelectedGroupId} />

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, gap: 2 }}>
            <GroupInterior
              group={selectedGroup}
              combatants={battleState.combatants}
              selectedAttackerId={selectedAttackerId}
              selectedDefenderId={selectedDefenderId}
              onSelectCombatant={handleSelectCombatant}
            />
            <Stack spacing={2}>
              <AttackPanel
                state={battleState}
                setState={setBattleState}
                attackerId={selectedAttackerId}
                defenderId={selectedDefenderId}
                onResult={setLastResult}
              />
              <BodyCoverageView combatant={defender} result={lastResult} />
              <CombatLog logs={battleState.log} />
            </Stack>
          </Box>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
