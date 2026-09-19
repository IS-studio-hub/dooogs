# L.I.S.A. — Locomotive Interactive Super Assistant (recreation)

Production-oriented recreation of [lisa.locomotive.ca/en](https://lisa.locomotive.ca/en): the conversational L.I.S.A. experience.

## Inventory

See [`INVENTORY.md`](./INVENTORY.md) for routes, components, animations, tokens, assets, and API notes.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- HLS video via `hls.js` (Mux streams)
- Framer Motion available; primary motion via CSS matching the reference easing
- Local mock enquiry APIs (no reCAPTCHA / production forwarding)

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en).

## 3D character (Blue Hoodie Ostrich)

Blender pipeline scripts:

- `scripts/rig_ostrich_character.py` — import Meshy GLB, decimate, armature, clips
- `scripts/fix_ostrich_skin.py` — proximity skin weights + neck chain + export

Outputs:

- `public/assets/lisa/character/ostrich.glb` — web-ready skinned model (`idle` / `talk` / `wave`)
- `public/assets/lisa/character/ostrich_rigged.blend` — open in Blender to refine weights/pose

Site integration: `LisaCharacter` (React Three Fiber) replaces Mux video on the LISA stage, with clip switching + mouse look.
