# Darren Ng — Software Engineer

An interactive resume for Darren Ng: a lamp-lit desk at night, seen from above in 3D (three.js). Each object on the desk is a section of the resume — pick it up to read it. A conventional Quick Resume view is always one click away.

## Run locally

From this folder:

```bash
npm install
npm run dev
```

Then open the URL printed by Next.js (normally `http://localhost:3000`). Use `npm run typecheck` and `npm run build` before deployment.

## Controls

- Click or tap an object on the desk to pick it up; `Esc` puts it back
- `Tab` moves between desk objects; `Enter` / `Space` picks up the focused one
- Scroll or pinch to zoom
- `R`: open Quick Resume
- `?`: show controls
- Sound is off by default and can be turned on from the view controls

## The desk asset

`public/assets/workstation.glb` is generated, not hand-edited. After changing `scripts/generate_workstation.py`, rebuild it with Blender 5.2:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/generate_workstation.py
```

All resume content is defined once in `app/resume-data.ts` and shared between the interactive world and Quick Resume mode.

`app.js` and `index.html` are the original vanilla prototype, kept for reference only; the runnable site is the Next.js app in `app/`.
