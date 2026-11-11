import React, { useEffect, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import { COMBAT_COLORS } from "./combatFeedback";
import { BattleLogCategory, BattleLogEntry, captureBattleLog, emptyBattleLog, MAX_BATTLE_LOG_ENTRIES } from "./battleLog";
import { TypingBossSessionSnapshot } from "./types";

const colors: Record<BattleLogCategory, string> = {
  Damage: COMBAT_COLORS.damage, Healing: COMBAT_COLORS.healing, Shield: COMBAT_COLORS.shield,
  Dodge: COMBAT_COLORS.dodge, Miss: COMBAT_COLORS.miss, Buff: COMBAT_COLORS.shield, Game: "#e2e8f0",
};

const BattleLogRow = React.memo(function BattleLogRow({ entry }: { entry: BattleLogEntry }) {
  return <Box component="li" sx={{ display:"flex", gap:1.5, alignItems:"flex-start", py:1.25, px:1, borderBottom:"1px solid #2b394e", borderLeft:`3px solid ${colors[entry.category]}` }}>
    <Typography component="time" dateTime={new Date(entry.at).toISOString()} variant="caption" sx={{ color:"#94a3b8", fontFamily:"monospace", whiteSpace:"nowrap", pt:.2 }}>
      {new Date(entry.at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false })}
    </Typography>
    <Box sx={{ minWidth:0 }}>
      <Typography variant="body2" sx={{ color:colors[entry.category], fontWeight:800, overflowWrap:"anywhere" }}>{entry.message}</Typography>
      <Typography variant="caption" sx={{ color:"#aabbd0", display:"block", overflowWrap:"anywhere" }}>{entry.category}{entry.detail ? ` · ${entry.detail}` : ""}</Typography>
    </Box>
  </Box>;
});

export default function HostBattleLog({ session }: { session: TypingBossSessionSnapshot }) {
  const [history, setHistory] = useState(() => emptyBattleLog(session.id));
  const [filter, setFilter] = useState("");
  useEffect(() => { setHistory(previous => captureBattleLog(previous, session)); }, [session]);
  const query = filter.trim().toLocaleLowerCase();
  const entries = history.entries.filter(entry => `${entry.category} ${entry.message} ${entry.detail || ""}`.toLocaleLowerCase().includes(query));
  return <Accordion disableGutters elevation={0} sx={{ border:"1px solid #50627a", borderRadius:2, bgcolor:"#101827", overflow:"hidden", "&:before":{display:"none"} }}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="host-battle-log-content" id="host-battle-log-heading">
      <Stack direction="row" gap={1} alignItems="center">
        <Typography fontWeight={900}>Battle log</Typography>
        <Chip size="small" label={history.entries.length} />
      </Stack>
    </AccordionSummary>
    <AccordionDetails id="host-battle-log-content" sx={{ pt:0 }}>
      <Typography variant="body2" sx={{ color:"#cbd5e1", mb:1.5 }}>Newest first · Last {MAX_BATTLE_LOG_ENTRIES} events seen on this host tab. Refreshing starts a new local history.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mb:1.5 }}>
        <TextField label="Filter battle log" placeholder="Player name, healing, crit…" value={filter} onChange={event => setFilter(event.target.value)} size="small" sx={{ flex:1, minWidth:180 }} />
        <Button size="small" disabled={!history.entries.length} onClick={() => { setHistory(previous => ({ ...previous, entries:[] })); setFilter(""); }}>Clear log</Button>
      </Stack>
      <Box component="ol" aria-label="Battle events" sx={{ listStyle:"none", p:0, m:0, maxHeight:420, overflowY:"auto" }}>
        {entries.map(entry => <BattleLogRow key={entry.id} entry={entry} />)}
      </Box>
      {!entries.length && <Typography sx={{ py:2, color:"#cbd5e1" }}>{query ? "No events match that filter." : "No events yet. New battle events will appear here."}</Typography>}
    </AccordionDetails>
  </Accordion>;
}
