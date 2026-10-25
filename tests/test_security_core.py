import json
import unittest
from pathlib import Path

from nectar_security.benchmark import evaluate_cases, load_fixture
from nectar_security.models import Evidence, Finding, Severity, ValidationError
from nectar_security.policy import ApprovalToken, CapabilityPolicy, Operation, authorize


ROOT = Path(__file__).resolve().parents[1]


class FindingSchemaTests(unittest.TestCase):
    def setUp(self):
        self.raw = json.loads((ROOT / "fixtures" / "findings.json").read_text())["findings"][0]

    def test_fixture_finding_round_trips_with_verified_evidence_digest(self):
        finding = Finding.from_dict(self.raw)
        self.assertEqual(finding.severity, Severity.CRITICAL)
        self.assertEqual(finding.evidence[0].path, "src/search.py")
        self.assertEqual(Finding.from_dict(finding.to_dict()), finding)

    def test_all_committed_fixture_findings_validate_as_synthetic(self):
        raw_findings = json.loads((ROOT / "fixtures" / "findings.json").read_text())["findings"]
        findings = [Finding.from_dict(item) for item in raw_findings]
        self.assertEqual(len(findings), 4)
        self.assertTrue(all(finding.synthetic for finding in findings))

    def test_evidence_digest_mismatch_is_rejected(self):
        evidence = dict(self.raw["evidence"][0], excerpt_sha256="0" * 64)
        with self.assertRaisesRegex(ValidationError, "does not match"):
            Evidence.from_dict(evidence)

    def test_parent_path_traversal_is_rejected(self):
        evidence = dict(self.raw["evidence"][0], path="../outside.py")
        with self.assertRaisesRegex(ValidationError, "repository-relative"):
            Evidence.from_dict(evidence)

    def test_non_normalized_and_windows_paths_are_rejected(self):
        for path in ("src//search.py", "src\\\\search.py"):
            with self.subTest(path=path):
                evidence = dict(self.raw["evidence"][0], path=path)
                with self.assertRaisesRegex(ValidationError, "repository-relative"):
                    Evidence.from_dict(evidence)

    def test_confidence_outside_unit_interval_is_rejected(self):
        with self.assertRaisesRegex(ValidationError, "confidence"):
            Finding.from_dict(dict(self.raw, confidence=1.01))


class CapabilityGateTests(unittest.TestCase):
    def setUp(self):
        self.policy = CapabilityPolicy(resources=frozenset({"orchard-api"}))

    def test_in_scope_reads_are_allowed(self):
        self.assertEqual(
            authorize(self.policy, Operation.READ, "orchard-api").reason,
            "in_scope_read",
        )

    def test_out_of_scope_reads_and_writes_are_denied(self):
        self.assertEqual(
            authorize(self.policy, Operation.READ, "other-repo").reason,
            "out_of_scope",
        )
        self.assertEqual(
            authorize(self.policy, Operation.WRITE, "other-repo").reason,
            "out_of_scope",
        )

    def test_write_is_denied_without_explicit_approval(self):
        decision = authorize(self.policy, Operation.WRITE, "orchard-api")
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "read_only_by_default")

    def test_mismatched_approval_cannot_expand_operation_or_scope(self):
        token = ApprovalToken("approval-1", Operation.WRITE, "other-repo", "reviewer")
        decision = authorize(self.policy, Operation.WRITE, "orchard-api", token)
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "approval_mismatch")

    def test_matching_explicit_approval_allows_only_that_write(self):
        token = ApprovalToken("approval-2", Operation.WRITE, "orchard-api", "reviewer")
        self.assertTrue(authorize(self.policy, Operation.WRITE, "orchard-api", token).allowed)
        self.assertEqual(authorize(self.policy, Operation.READ, "orchard-api", token).reason, "in_scope_read")

    def test_malformed_approval_fails_closed(self):
        token = ApprovalToken(None, Operation.WRITE, "orchard-api", None)
        decision = authorize(self.policy, Operation.WRITE, "orchard-api", token)
        self.assertFalse(decision.allowed)
        self.assertEqual(decision.reason, "approval_mismatch")

    def test_unapproved_and_unsupported_operations_fail_closed(self):
        token = ApprovalToken("approval-3", Operation.WRITE, "orchard-api", "reviewer", approved=False)
        self.assertEqual(
            authorize(self.policy, Operation.WRITE, "orchard-api", token).reason,
            "approval_mismatch",
        )
        self.assertEqual(
            authorize(self.policy, "scan", "orchard-api").reason,
            "unsupported_operation",
        )


class FixtureBenchmarkTests(unittest.TestCase):
    def test_fixture_set_has_stable_confusion_counts(self):
        fixture = load_fixture()
        result = evaluate_cases(fixture["cases"])
        self.assertTrue(fixture["synthetic"])
        self.assertEqual((result.cases, result.true_positives, result.false_positives, result.false_negatives), (6, 4, 1, 1))
        self.assertEqual(result.precision, 0.8)
        self.assertEqual(result.recall, 0.8)


if __name__ == "__main__":
    unittest.main()
