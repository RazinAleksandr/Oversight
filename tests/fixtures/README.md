# UX pilot fixtures

These are synthetic engine test states, never copied from a user's phone.

- `ux-pilot-turn6.json`: deterministic seed 20261012, Director/Commonwealth, turn 6; deployment of Lingua-3 provides four choices and a company investigation target.
- `ux-pilot-evidence.json`: one engine evidence record from the synthetic turn-10 run. The QA generator binds it to the deployment company to exercise the optional fifth choice.

`scripts/ux-pilot-smoke.mjs` loads these isolated browser fixtures and regenerates Russian deployment cards through the real localized engine. English serialized card text is not used as a substitute for Russian content testing. Generated artifacts remain under `artifacts/ux-pilot/`.
