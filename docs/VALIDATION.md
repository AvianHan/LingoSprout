# Delivery validation — 2 October 2026

## Checked

- 18 automated tests passed: local storage and settings, reveal/save separation, contextual bank senses, sense-specific known/error suppression, user limits and density lock, review scheduling, three language pairs, structured output validation, compact profiles, scripted chat, grammar-state storage, gateway origin/Host checks and simulated-provider success/error paths.
- Browser preview: explicit activation; six-word selection; separate bank meanings; explicit save; known feedback and refresh; translation-error restoration and suppression; three-word cap; Slovak and Thai sample replacement; profile records; explicit sample loading; reveal/recall scheduling; correct quiz feedback; grammar exercise; guided conversation; visible error when the optional gateway is unavailable; return to demo mode; feedback counts and error list.
- Desktop layout at 1280 × 1000 and article layout at the smaller 717 px browser width were inspected. Article and profile screenshots in the proposal come from the running local preview.
- Final JavaScript syntax checks passed. The packaged manifest lists explicit active-tab access, storage, scripting and loopback gateway access; no automatic all-site content script is registered.

## Still to rehearse on the presentation machine

- Loading the unpacked extension in Chrome and its installed-extension permission flow. The browser checks above used the local web preview.
- Pronunciation quality and voice availability on the presentation computer.
- A real hosted model connection, its response quality, latency, cost and retention settings. Gateway tests use simulated responses; no paid model was called.
- Google Docs may repaginate the editable proposal after import. Use the delivered PDF to check the final four-page layout.

All displayed sample records are labelled. Review activity and self-reported familiarity are not learning-outcome measurements.
