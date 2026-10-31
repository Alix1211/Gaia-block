# GAIA Heart Breaker — block materials v1

2026-10-31, first approved material direction. This is an **asset pack only**;
the existing game renderer, collision logic, and `glass-bricks.png` remain unchanged.

The folder contains **20 individual transparent PNG bricks** cut without
redrawing from `assets/concepts/gaia-bricks-materials-v1.png`.

Each of the five materials has four variants:

1. `rect`: normal horizontal brick
2. `square`: square brick
3. `long`: long horizontal brick
4. `rect-alt`: another horizontal color variant

Materials: `01-jelly`, `02-pink-metal`, `03-pink-wood`, `04-neon`,
`05-solid`. The color intensity can be reduced later as a non-destructive
color correction; retain the original pixels as the baseline.

The source image's alpha channel is preserved, including optional neon glow.
Do not use the large atlas itself as a whole-screen background or replace the
approved glass-brick atlas without updating sprite extraction coordinates.
