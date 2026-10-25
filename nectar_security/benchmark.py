"""Repeatable, offline benchmark over the committed synthetic fixture set."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping


@dataclass(frozen=True)
class BenchmarkResult:
    cases: int
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float


def evaluate_cases(cases: Iterable[Mapping[str, Any]]) -> BenchmarkResult:
    case_count = 0
    true_positives = 0
    false_positives = 0
    false_negatives = 0

    for case in cases:
        expected = set(case["expected_rule_ids"])
        observed = set(case["observed_rule_ids"])
        true_positives += len(expected & observed)
        false_positives += len(observed - expected)
        false_negatives += len(expected - observed)
        case_count += 1

    precision_denominator = true_positives + false_positives
    recall_denominator = true_positives + false_negatives
    precision = true_positives / precision_denominator if precision_denominator else 0.0
    recall = true_positives / recall_denominator if recall_denominator else 0.0
    return BenchmarkResult(
        cases=case_count,
        true_positives=true_positives,
        false_positives=false_positives,
        false_negatives=false_negatives,
        precision=precision,
        recall=recall,
    )


def load_fixture(path: Path | None = None) -> Dict[str, Any]:
    fixture_path = path or Path(__file__).resolve().parents[1] / "fixtures" / "benchmark.json"
    with fixture_path.open("r", encoding="utf-8") as fixture_file:
        data = json.load(fixture_file)
    if data.get("synthetic") is not True or not isinstance(data.get("cases"), list):
        raise ValueError("benchmark fixture must be a labeled synthetic case list")
    for case in data["cases"]:
        if not isinstance(case.get("expected_rule_ids"), list) or not isinstance(
            case.get("observed_rule_ids"), list
        ):
            raise ValueError("each case must define expected and observed rule ID lists")
    return data


def main() -> None:
    fixture = load_fixture()
    result = evaluate_cases(fixture["cases"])
    print(
        "synthetic_cases={cases} tp={tp} fp={fp} fn={fn} precision={precision:.3f} recall={recall:.3f}".format(
            cases=result.cases,
            tp=result.true_positives,
            fp=result.false_positives,
            fn=result.false_negatives,
            precision=result.precision,
            recall=result.recall,
        )
    )


if __name__ == "__main__":
    main()
