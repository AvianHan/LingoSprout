# LingoSprout · Presentation prototype

A functional presentation demo of the Group B5 proposal. Read an article, explore a word in its sentence, give feedback and revisit saved vocabulary in a learning profile. The default mode is a transparent, offline demonstration using curated examples. It is not a running large language model.

## Open the demo

### As a Chrome extension — no API key or server needed
1. Unzip this folder somewhere you want to keep it.
2. Open `chrome://extensions`, switch on **Developer mode**, choose **Load unpacked**, and select the folder that contains `manifest.json`.
3. Pin LingoSprout. Open its popup and select **Open demo article**.
4. Select **Start learning**. Open a green word, save it or give feedback, then open **My learning space**.

On other public article pages, use **Activate this page** in the popup. Chrome grants access to the tab you explicitly activate. No automatic reading on all sites is registered. Some pages have no identifiable article or are excluded; browser-internal pages cannot be used. The curated mode has a small vocabulary and will not translate arbitrary websites comprehensively.

### As a local website — for rehearsing or sharing the files with teammates
With Node.js 20 or newer installed, run `node preview.mjs` from this folder. Open `http://127.0.0.1:8766/demo-page.html`. Stop the server with Ctrl+C. A modern browser is required. Nothing is deployed online.

The website stores its learning profile in this browser and local origin. The installed extension uses its own Chrome storage. These are separate profiles. Keep the same address and browser between rehearsal sessions.

## Suggested five-minute presentation

1. **Article and context.** English → Chinese, B1, Career, up to six words, fixed limit. Select Start learning. In the same article, `bank` in a loan sentence becomes `银行`, while the river-bank sense becomes `河岸`.
2. **Word card.** Open a highlighted word. Show the original, pronunciation, estimated difficulty and contextual meaning. Save it to review. Pronunciation uses the browser's available voices.
3. **Feedback loop.** Select Already known, then Refresh selection: only that word sense is excluded. Too difficult / Suitable / Too easy affect future ranking. A translation-error report restores the source and suppresses that sense pending review. The error label stays in the local record.
4. **Learning space.** Open the profile. Use **Load demo learning history** if you want additional labelled sample cards; nothing is preloaded silently. Reveal a due card, grade your recall, try the vocabulary quiz, grammar practice and conversation.
5. **Control.** Show the three language pairs, A1–C2 settings, goals, maximum word count, density lock and privacy controls. Restore original text whenever you want.

To repeat the demonstration with a fresh profile, use **Privacy & settings → Clear learning data**, then the second confirmation button. This removes vocabulary, feedback and grammar practice records from this demo profile, so export any records you want to retain first. It leaves preferences intact. Sample loading adds records; it does not silently erase feedback or change a marked-known word back to unknown.

## What works

- Explicit page activation and exact-span contextual substitutions; article text is restored on demand.
- English → Chinese as the main demonstration; short Slovak → English and Thai → Chinese examples.
- Learner controls, sense-specific feedback, user word limits and a density lock.
- Explicit saving of a word with its sentence; revealing a word alone does not save the sentence or establish mastery.
- Saved vocabulary, due-card review with changing intervals, a vocabulary quiz, authored grammar practice and guided conversation.
- Labelled sample history, local progress and feedback counts, JSON export and clear-data controls.
- An optional local gateway for a real hosted model: see **docs/AI_SETUP.md**. No key is included or stored in the extension.

## Demonstration boundaries

- Offline selection, contextual sense explanations, CEFR labels and grammar examples are authored demonstrations. CEFR estimates are provisional, not certified measurements. Offline conversation is a scripted practice exchange, not unrestricted AI conversation or assessment.
- Review scheduling is a simple prototype algorithm. Activity counts, recall grades and self-reported known words do not demonstrate long-term retention or general language proficiency.
- Error and feedback labels update local selection preferences. They do not train or fine-tune model weights. Error records remain suppressed; a human review/resolution workflow is future work.
- The article is an original fictional example. Sample profile data is clearly labelled. No learner study or accuracy result is implied.
- The optional live gateway has validation and simulated-provider tests, but no paid model connection has been tested in this delivery. You must configure and rehearse your own provider before using live mode.
- Only selected article sentences and a minimal profile are sent in live mode. The page filter is a basic prototype safeguard; do not activate live mode on private content. Provider retention must be checked separately.

## Validation

Run `node --test tests/core.test.js` to exercise storage, feedback, sense distinctions, limits, request validation and the local gateway against simulated model responses. Browser interactions were checked in a local preview; loading the unpacked extension and the optional live model connection should be rehearsed on the actual presentation machine.
