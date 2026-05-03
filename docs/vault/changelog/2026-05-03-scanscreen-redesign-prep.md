# 2026-05-03 — ScanScreen redesign prep

## Summary

User provided a light-theme ScanScreen visual reference and custom SVG icons. The redesign itself is not implemented yet; this note preserves the first safe preparation step.

## Completed

- Replaced gallery Material Symbol with an inline SVG component.
- Added torch off/on inline SVG variants using `currentColor`.
- Added compare inline SVG with mirrored active state for pressed/active feedback.
- Added a history SVG placeholder for the upcoming manual/recent action.
- Added a filled camera-switch SVG variant for future pressed-state animation.

## Constraints for the redesign

- Preserve scanner logic and product lookup behavior.
- Keep all new UI adaptive for different phone sizes.
- Support both light and dark themes using existing CSS variables.
- Match the project typography rhythm, especially the profile title scale/weight.
- Use the reference image as visual direction, not fixed pixel-perfect dimensions.

## Verification

- `npm run build` — passed.
- `npm run lint` — passed with warnings only.
