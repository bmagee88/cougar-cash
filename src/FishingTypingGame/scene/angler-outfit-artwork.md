# Seasonal angler artwork

Created with three separate edits using the built-in **imagegen** tool. Each edit referenced the original `public/assets/fishing/characters/angler-painted.png`, which is retained as spring attire. All four bodies are 1024 × 1536 RGBA images with transparent backgrounds. The rod, bobber, dock, rig anchors and landing animation remain independent.

## Saved assets

Paths are relative to `C:/Users/Kathleen Dippyolito/Documents/Clemente Projects/cougar-cash/`:

| Season | Asset | Outfit |
|---|---|---|
| Spring | `public/assets/fishing/characters/angler-painted.png` | Original olive shirt, hat, trousers and boots |
| Summer | `public/assets/fishing/characters/angler-summer-painted.png` | Light blue short-sleeve fishing shirt, sand khaki trousers, tan boots, khaki bucket hat |
| Autumn | `public/assets/fishing/characters/angler-autumn-painted.png` | Forest green field jacket, rust/cream plaid flannel, charcoal brown trousers, brown boots, olive bucket hat |
| Winter | `public/assets/fishing/characters/angler-winter-painted.png` | Slate blue padded parka, wool cuffs, burgundy scarf, charcoal trousers, insulated brown boots, olive knit beanie and dark fingerless gloves |

## Prompt specifications used

The following captures the shared constraints and seasonal clothing instructions supplied to the three image edits:

Use case: identity-preserve. Edit Image 1, the existing transparent painted fisherman sprite, changing clothing only. Preserve the same person, face, hair, beard, expression, right-facing seated pose, curved empty hands, head, hips, knees, boots, scale and padding. Keep the exact 1024 × 1536 canvas. Preserve the hips near normalized (0.32, 0.58) and grip near (0.85, 0.435). Match the original painterly brush texture and neutral daylight. Preserve genuine transparent alpha with clean edges; no background, glow, halo, ground shadow, dock, seat, rod, reel, line, fish, added props, text or watermark.

- **Summer:** replace the heavy olive clothing with a light blue short-sleeve fishing shirt, sand khaki trousers, tan boots and khaki bucket hat. Keep exposed arms natural and the existing hands unchanged.
- **Autumn:** add a forest green field jacket over a rust and cream plaid flannel shirt, charcoal brown trousers, brown leather boots and olive bucket hat. Preserve the original body silhouette, seat and grip.
- **Winter:** use a slate blue padded parka with wool cuffs, burgundy scarf, charcoal insulated trousers, insulated brown boots, olive knit beanie and dark fingerless gloves. Keep facial identity and fingertip/grip positions unchanged; no snow or scenery.

The outputs were visually inspected, copied into the asset directory and wired through `ANGLER_OUTFITS`. Season selection changes only the body image. The same seated geometry, separately rendered rod and lap anchor are used in every season and location.
