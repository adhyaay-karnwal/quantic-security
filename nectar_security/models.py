"""Small validated schemas for findings and their evidence provenance."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from enum import Enum
from pathlib import PurePosixPath
from typing import Any, Dict, Tuple


class ValidationError(ValueError):
    """Raised when untrusted finding or evidence input is malformed."""


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError("{} must be a non-empty string".format(field))
    return value.strip()


@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    source: str
    source_ref: str
    path: str
    line_start: int
    line_end: int
    excerpt: str
    excerpt_sha256: str
    synthetic: bool = True

    def __post_init__(self) -> None:
        for field in ("evidence_id", "source", "source_ref", "path", "excerpt"):
            _text(getattr(self, field), field)
        path = PurePosixPath(self.path)
        if path.is_absolute() or ".." in path.parts or str(path) in ("", "."):
            raise ValidationError("path must be a normalized repository-relative path")
        if not isinstance(self.line_start, int) or isinstance(self.line_start, bool) or self.line_start < 1:
            raise ValidationError("line_start must be a positive integer")
        if not isinstance(self.line_end, int) or isinstance(self.line_end, bool) or self.line_end < self.line_start:
            raise ValidationError("line_end must be an integer >= line_start")
        if not isinstance(self.synthetic, bool):
            raise ValidationError("synthetic must be a boolean")
        if not re.fullmatch(r"[0-9a-f]{64}", self.excerpt_sha256):
            raise ValidationError("excerpt_sha256 must be a lowercase SHA-256 digest")
        actual = hashlib.sha256(self.excerpt.encode("utf-8")).hexdigest()
        if actual != self.excerpt_sha256:
            raise ValidationError("excerpt_sha256 does not match the supplied excerpt")

    @classmethod
    def from_dict(cls, value: Dict[str, Any]) -> "Evidence":
        try:
            return cls(
                evidence_id=value["evidence_id"],
                source=value["source"],
                source_ref=value["source_ref"],
                path=value["path"],
                line_start=value["line_start"],
                line_end=value["line_end"],
                excerpt=value["excerpt"],
                excerpt_sha256=value["excerpt_sha256"],
                synthetic=value.get("synthetic", True),
            )
        except (KeyError, TypeError) as exc:
            raise ValidationError("evidence is missing a required field") from exc

    def to_dict(self) -> Dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "source": self.source,
            "source_ref": self.source_ref,
            "path": self.path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "excerpt": self.excerpt,
            "excerpt_sha256": self.excerpt_sha256,
            "synthetic": self.synthetic,
        }


@dataclass(frozen=True)
class Finding:
    finding_id: str
    rule_id: str
    title: str
    severity: Severity
    confidence: float
    description: str
    repository: str
    evidence: Tuple[Evidence, ...]
    recommendation: str
    synthetic: bool = True

    def __post_init__(self) -> None:
        for field in (
            "finding_id",
            "rule_id",
            "title",
            "description",
            "repository",
            "recommendation",
        ):
            _text(getattr(self, field), field)
        if not isinstance(self.severity, Severity):
            raise ValidationError("severity must be a supported Severity")
        if isinstance(self.confidence, bool) or not isinstance(self.confidence, (int, float)):
            raise ValidationError("confidence must be a number between 0 and 1")
        if not 0 <= self.confidence <= 1:
            raise ValidationError("confidence must be a number between 0 and 1")
        if not isinstance(self.evidence, tuple) or not self.evidence:
            raise ValidationError("at least one evidence item is required")
        if any(not isinstance(item, Evidence) for item in self.evidence):
            raise ValidationError("evidence items must use the Evidence schema")
        if not isinstance(self.synthetic, bool):
            raise ValidationError("synthetic must be a boolean")

    @classmethod
    def from_dict(cls, value: Dict[str, Any]) -> "Finding":
        try:
            severity = Severity(value["severity"])
            raw_evidence = value["evidence"]
            if not isinstance(raw_evidence, list):
                raise ValidationError("evidence must be a list")
            return cls(
                finding_id=value["finding_id"],
                rule_id=value["rule_id"],
                title=value["title"],
                severity=severity,
                confidence=value["confidence"],
                description=value["description"],
                repository=value["repository"],
                evidence=tuple(Evidence.from_dict(item) for item in raw_evidence),
                recommendation=value["recommendation"],
                synthetic=value.get("synthetic", True),
            )
        except ValueError as exc:
            if isinstance(exc, ValidationError):
                raise
            raise ValidationError("severity is not supported") from exc
        except (KeyError, TypeError) as exc:
            raise ValidationError("finding is missing a required field") from exc

    def to_dict(self) -> Dict[str, Any]:
        return {
            "finding_id": self.finding_id,
            "rule_id": self.rule_id,
            "title": self.title,
            "severity": self.severity.value,
            "confidence": self.confidence,
            "description": self.description,
            "repository": self.repository,
            "evidence": [item.to_dict() for item in self.evidence],
            "recommendation": self.recommendation,
            "synthetic": self.synthetic,
        }
