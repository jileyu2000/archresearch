# Evaluation fixtures

This directory contains offline, versioned fixtures for the ArchResearch M6 evaluation. Loading or validating these files does not call OpenAI or any website.

## Classification set

`classification/dataset.json` is the source manifest. It defines the exact nine-class taxonomy, dataset version, generation date, CC0 license, seed, and 12 variants per class.

`classification/generate.ps1` deterministically creates:

- `classification/generated/samples.jsonl`: 108 labeled classification records;
- `classification/generated/images/*.svg`: 108 original synthetic drawings, with no third-party imagery.

Each record contains the expected class, relative image path, SHA-256, caption, bounded project context, research question, expected relevance and observable cues. The relevance cases are evenly split across 1, 3 and 4 so classification and question relevance can be evaluated separately.

Regenerate and verify from the repository root:

```powershell
pwsh -NoProfile -File scripts/validate-evaluation-fixtures.ps1
```

The validator generates the dataset twice and compares every relative path and hash. It also parses every image as SVG XML and checks that all nine classes have at least 12 unique samples.

These synthetic fixtures test contracts, class balance and repeatability. They do not replace the separate 100+ independently collected and rights-cleared real-image benchmark needed before making claims about production classification accuracy.
