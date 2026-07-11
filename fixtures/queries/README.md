# Versioned research tasks

`research_tasks.jsonl` contains 30 human-authored architecture research tasks. It is a data fixture and never starts network research by itself.

Every line records:

- `schema_version` and `evaluation_date`;
- stable task `id`, research `goal`, question, requested asset types and budget mode;
- whether the evaluator must supply a user-owned image or PDF;
- expected minimum usable assets, project diversity, evidence coverage, required asset types and an explicit evidence boundary.

The set covers 20 precedent research tasks, five source lookups and five visual reference searches. All asset labels use the production nine-class enum.

Real execution is opt-in because web content changes and provider calls may cost money. Record the execution date, application commit, models, query/page counts, cost, final status, stop reason, CoverageReport and human relevance labels as described in `docs/demo-flows.md`. Never store provider keys in an evaluation record.

