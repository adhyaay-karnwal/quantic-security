# Nectar Security

An original, local prototype for an evidence-led security operations workflow. It demonstrates **fixture repository input → finding with provenance → reviewable fix proposal → regression evidence**. It is not a scanner or a connected security service.

## Run the prototype

Requires Python 3.9+; the app and tests use only the Python standard library.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open [http://localhost:4173](http://localhost:4173). All repository names, code excerpts, findings, approval states, and benchmark cases shown in the UI are labeled synthetic fixtures. Setup selections are stored only in this browser's local storage.

## Run the deterministic core

```bash
python3 -m unittest discover -s tests -v
python3 -m nectar_security.benchmark
```

The benchmark replays six committed fixture cases and calculates counts from their fixed expected/observed rule IDs. It makes no network requests and does not scan source code.

## Safety boundary

- No Git/provider connection, repository upload, external account, credential, or production service is configured.
- No active scanner, exploit runner, code interpreter, shell integration, patch writer, auto-merge, or provider integration is implemented.
- The Python authorization gate is a pure policy check; it does not execute or apply an action. Reads are limited to exact configured resource names. Writes fail closed unless an explicit token object matches the operation and resource.
- See [THREAT_MODEL.md](THREAT_MODEL.md) for assumptions, data handling, and limitations.
