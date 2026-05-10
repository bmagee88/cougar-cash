export const SIMULATION_ROUNDS = 50;

export const DAMAGE_TYPES = [
  { type: "fire", emoji: "🔥", names: ["Cinderhorn Drake", "Ash Pup", "Ember Imp"] },
  { type: "cold", emoji: "❄️", names: ["Frostveil Lynx", "Snowcap Sprite", "Icehorn Cub"] },
  { type: "lightning", emoji: "⚡", names: ["Stormcoil Kirin", "Spark Hare", "Thunder Finch"] },
  { type: "poison", emoji: "☠️", names: ["Venomglade Asp", "Toxic Toad", "Bilewing Moth"] },
  { type: "acid", emoji: "🧪", names: ["Caustic Miremaw", "Slimejaw", "Sourbelly Newt"] },
  { type: "psychic", emoji: "🧠", names: ["Dreamglass Moth", "Mindmurmur", "Echo-Eye Fox"] },
  { type: "radiant", emoji: "☀️", names: ["Dawnmane Hart", "Glowtail", "Sunwisp Fawn"] },
  { type: "necrotic", emoji: "🌑", names: ["Gravesap Willow", "Bonecap", "Witherling"] },
  { type: "bludgeoning", emoji: "🪨", names: ["Granite Knuckleback", "Pebble Ox", "Hammerhorn"] },
  { type: "slashing", emoji: "🗡️", names: ["Razorvine Panther", "Bladeclaw", "Briar Fang"] },
  { type: "piercing", emoji: "🏹", names: ["Needlebeak Raptor", "Spine Imp", "Thornfin"] },
  { type: "thunder", emoji: "🔊", names: ["Boomshell Toad", "Echo Ram", "Sonic Beetle"] },
  { type: "force", emoji: "💥", names: ["Aether Bulwark", "Pulse Ray", "Kinetic Wisp"] },
] as const;

export const DND_DAMAGE_TYPES = DAMAGE_TYPES.map((item) => item.type);
export const UTILITY_SKILLS = ["bindingResist", "bodyControl", "focus", "recovery"];
