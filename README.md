# Fly in Quantum Backrooms

A small fly.ai inhabitant in an independent reconstruction of Quantum Backrooms Floor 1. Published by the Synthetic Humanities Lab.

[Watch the fly](https://synthetic-humanities-lab.github.io/fly-in-quantum-backrooms/) · [Play the original Quantum Backrooms](https://backrooms.mothquantum.com/)

Choose Follow, Over shoulder or First person. Pause, restart and sound controls sit along the bottom; click the corner map to expand it. The upper-left neural view shows actual activity alongside the map. Sound starts automatically where the browser permits it; otherwise the first click or keypress enables sound.

The Cleanroom-style entity wanders elsewhere in the level from the start. It appears as a glowing red-pink marker when inside the map viewport. It never pursues or harms the fly. There is no manual flight mode, collection, sanity death or campaign progression.

The full pinned fly.ai network runs locally in a browser worker. First load is about 139 MB and is cached when browser storage is available. No backend, account, API key or live QPU call is required. The simulation slows coherently if inference cannot keep up.

## Run and build

Node.js 22 or newer. No dependency installation is needed.

```sh
npm run dev
npm test
npm run check
npm run build
```

The static site is built into `dist/`. GitHub Actions checks the source and model hashes, runs tests, and deploys that directory to GitHub Pages.

## Sources and attribution

The world uses the unmodified public 6×6 IQM Floor 1 measurement dataset and the inspected main First Person / Hard observation and wall-transition rules. Sampling is local from retained measured records. The fly's pose drives observation; spectator cameras do not.

The fly.ai numerical core, model weights and PCG noise are pinned. Local geometry feature detection and the motor/body coupling are authored adapters, not validated biological flight or Odyssey's unpublished implementation. The neural view plots 12,000 measured coordinate samples from the same pinned MaleCNS archive and highlights spikes in the last committed neural block. It is a display sample; all 166,700 neurons still run. The coordinate export is reproducible with `scripts/export-spatial.py` and the pinned archive (NumPy is needed only for this development export).

The displayed fly uses the credited NeuroMechFly asset. Wallpaper, signs and the Cleanroom-style entity are independently authored replacements; the entity mesh and gait are approximations. This is not an official Moth or Odyssey release.

See [complete credits and provenance](public/credits.txt), [entity notice](public/assets/CLEANROOM-NOTICE.txt), and the component licences under `public/model/`, `public/assets/fly/` and `public/vendor/`.
