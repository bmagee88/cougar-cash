import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import type { AttackPlan, AttackStep, Combatant } from "../engine/types/combat";
import { BODY_SCALE_MAX, BODY_SCALE_MIN, bodyMap, missZones } from "../engine/data/bodyMap";
import { clamp } from "../engine/utils/math";
import { markerBottom } from "../engine/rules/targetingRules";

export function BodyCoverageView({ defender, plan, step }: { defender: Combatant; plan: AttackPlan | null; step: AttackStep }) {
  const armorSegments = defender.armor.flatMap((piece) =>
    piece.coverageRanges.map((range) => ({
      piece,
      start: clamp(range.start, BODY_SCALE_MIN, BODY_SCALE_MAX),
      end: clamp(range.end, BODY_SCALE_MIN, BODY_SCALE_MAX),
    })),
  );

  const visibleMarkers = plan
    ? [
        { label: "initial", value: plan.initialMarker, show: ["initial", "evaded", "corrected", "resolved"].includes(step), color: "rgba(33,150,243,.45)", border: "#0d47a1" },
        { label: "evaded", value: plan.afterDefenderMarker, show: ["evaded", "corrected", "resolved"].includes(step), color: "rgba(255,193,7,.65)", border: "#8a5a00" },
        { label: "final", value: plan.finalMarker, show: ["corrected", "resolved"].includes(step), color: "rgba(76,175,80,.95)", border: "#1b5e20" },
      ].filter((m) => m.show)
    : [];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={800} gutterBottom>Body Coverage: {defender.name}</Typography>
        <Box sx={{ border: "1px solid", borderColor: "divider", bgcolor: "grey.50", borderRadius: 2, p: 2 }}>
          <Box sx={{ position: "relative", height: 620, maxWidth: 520, mx: "auto" }}>
            <Box sx={{ position: "absolute", left: 32, top: 0, height: "100%", width: 96, overflow: "hidden", borderRadius: 2, border: "2px solid", borderColor: "grey.900", bgcolor: "white" }}>
              {bodyMap.map((range) => {
                const bottom = (range.start / BODY_SCALE_MAX) * 100;
                const height = ((range.end - range.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
                return <Box key={range.part} title={`${range.label}: ${range.start}-${range.end}`} sx={{ position: "absolute", left: 0, right: 0, borderTop: "2px solid", borderColor: "grey.800", bgcolor: "grey.300", bottom: `${bottom}%`, height: `${height}%` }} />;
              })}
              {missZones.map((zone) => {
                const bottom = (zone.start / BODY_SCALE_MAX) * 100;
                const height = ((zone.end - zone.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
                return <Box key={zone.label} title={`${zone.label}: ${zone.start}-${zone.end}`} sx={{ position: "absolute", left: 0, right: 0, borderY: "1px solid", borderColor: "error.main", bgcolor: "error.light", opacity: .55, bottom: `${bottom}%`, height: `${height}%` }} />;
              })}
            </Box>

            <Box sx={{ position: "absolute", left: 56, top: 0, height: "100%", width: 48, overflow: "hidden", borderRadius: 2, border: "1px solid", borderColor: "grey.700" }}>
              {armorSegments.map((segment, index) => {
                const bottom = (segment.start / BODY_SCALE_MAX) * 100;
                const height = ((segment.end - segment.start + 1) / (BODY_SCALE_MAX + 1)) * 100;
                return <Box key={`${segment.piece.id}-${index}`} title={`${segment.piece.name}: ${segment.start}-${segment.end}`} sx={{ position: "absolute", left: 4, right: 4, bgcolor: "grey.900", opacity: .9, border: "1px solid black", bottom: `${bottom}%`, height: `${height}%` }} />;
              })}
            </Box>

            {visibleMarkers.map((m) => (
              <Box key={m.label} sx={{ position: "absolute", left: 8, zIndex: 20, display: "flex", alignItems: "center", gap: .5, bottom: `calc(${markerBottom(m.value)} - 8px)` }}>
                <Box sx={{ height: 16, width: 130, borderRadius: 999, bgcolor: m.color, border: `2px solid ${m.border}` }} />
                <Box sx={{ bgcolor: "white", borderRadius: 1, px: .5, boxShadow: 1, fontSize: 12, fontWeight: 800 }}>{m.label}: {m.value}</Box>
              </Box>
            ))}

            <Box sx={{ position: "absolute", left: 160, top: 0, height: "100%", width: "calc(100% - 160px)" }}>
              {[...bodyMap].reverse().map((range) => {
                const top = 100 - (range.end / BODY_SCALE_MAX) * 100;
                const protectedSegments = armorSegments.filter((segment) => segment.start <= range.end && segment.end >= range.start);
                return (
                  <Box key={range.part} sx={{ position: "absolute", left: 0, right: 0, display: "flex", alignItems: "flex-start", gap: 1, top: `${top}%`, fontSize: 12 }}>
                    <Box sx={{ mt: 1, height: 1, width: 32, bgcolor: "grey.500" }} />
                    <Box sx={{ border: "1px solid", borderColor: "divider", bgcolor: "white", borderRadius: 2, px: 1, py: .5, boxShadow: 1 }}>
                      <Typography variant="caption" fontWeight={900}>{range.label}: {range.start}-{range.end}</Typography>
                      {protectedSegments.length > 0 ? protectedSegments.map((segment, index) => (
                        <Typography key={`${range.part}-${segment.piece.id}-${index}`} variant="caption" display="block" color="text.secondary">
                          {segment.piece.name}: {Math.max(segment.start, range.start)}-{Math.min(segment.end, range.end)}
                        </Typography>
                      )) : <Typography variant="caption" display="block" color="error">exposed</Typography>}
                    </Box>
                  </Box>
                );
              })}
              {missZones.map((zone) => {
                const top = 100 - (zone.end / BODY_SCALE_MAX) * 100;
                return <Box key={zone.label} sx={{ position: "absolute", left: 0, display: "flex", alignItems: "center", gap: 1, color: "error.dark", top: `${top}%` }}><Box sx={{ height: 1, width: 20, bgcolor: "error.main" }} /><Typography variant="caption" sx={{ bgcolor: "error.50", borderRadius: 999, px: 1 }}>miss {zone.start}-{zone.end}</Typography></Box>;
              })}
            </Box>

            <Typography variant="caption" sx={{ position: "absolute", left: 0, top: 0, fontWeight: 800, color: "text.secondary" }}>150</Typography>
            <Typography variant="caption" sx={{ position: "absolute", left: 0, bottom: 0, fontWeight: 800, color: "text.secondary" }}>0</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
