# Threat model and safety boundaries

## Prototype purpose

Nectar Security demonstrates one reviewable loop: explicitly selected synthetic repository scope, an evidence-backed synthetic finding, a safe fix proposal that stops at human review, and deterministic regression fixture results. This artifact is not a security product deployment and makes no real detections.

## Assets and trust boundaries

- **Fixture data:** committed examples in `fixtures/`; they are invented and marked `synthetic: true`.
- **Browser state:** selected fixture scopes may be saved in local storage on the device running the prototype. No account, cookie, repository source, or secret is collected by the app.
- **Finding provenance:** evidence carries a relative path, line range, source reference, and SHA-256 digest of its excerpt. The digest verifies fixture excerpt integrity; it does not prove that a repository or detection is authentic.
- **Authorization policy:** the Python gate accepts an exact resource name. In-scope reads are permitted; writes require an explicit, matching approval token object. Out-of-scope and unknown operations are rejected.

## Adversaries and failure modes considered

- Malformed evidence, digest substitution, invalid confidence, and path traversal are rejected by the data schemas.
- A finding or write request naming a resource outside the declared scope is denied.
- Missing, unapproved, operation-mismatched, or resource-mismatched approval is denied.
- A benchmark case cannot silently change without changing the versioned fixture inputs and expected test outcome.

## Explicit limits

- The in-memory `ApprovalToken` is a demonstration object, not a signed credential, identity assertion, or durable approval record. The gate is not an authentication system and does not provide concurrency control or audit storage.
- No repository provider is connected, no files are fetched, and no writes are performed. The “approval” interactions in the web UI only change local prototype state and are not passed to an executor.
- There is no active scanning, exploit execution, model-generated patching, runtime isolation, secret scanning service, alert ingestion, on-call paging, or production telemetry.
- The fixture benchmark measures only the committed labels; its precision and recall say nothing about real-world detection quality.
- The static web app is a prototype, not a hardened multi-tenant service. Do not put confidential code or credentials into it.

## Data handling

All supplied examples are local repository fixtures. The UI fetches only the two committed JSON fixture files from the local static server. The Python benchmark reads the committed JSON file. Neither component makes outbound network requests. Browser local storage is limited to the user-selected fixture repository names and mock approval status; clearing site data resets the prototype.

## Before any production use

Add an authenticated, provider-scoped read boundary; signed, expiring, single-use approvals bound to an immutable diff and repository revision; durable audit events; isolation and resource limits; tested patch generation and sandboxing; tenant-aware data retention controls; and independent security review. Keep merge and execution capabilities out of scope until those controls exist.
