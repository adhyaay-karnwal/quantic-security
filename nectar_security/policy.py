"""A deliberately small, default-deny capability and approval boundary."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import FrozenSet, Optional


class Operation(str, Enum):
    READ = "read"
    WRITE = "write"


@dataclass(frozen=True)
class CapabilityPolicy:
    """Exact resource scope; reads are allowed and writes remain approval-gated."""

    resources: FrozenSet[str]
    read_only: bool = True


@dataclass(frozen=True)
class ApprovalToken:
    """An explicit, narrowly scoped reviewer decision (not a credential)."""

    token_id: str
    operation: Operation
    resource: str
    approved_by: str
    approved: bool = True


@dataclass(frozen=True)
class AuthorizationDecision:
    allowed: bool
    reason: str


def authorize(
    policy: CapabilityPolicy,
    operation: Operation,
    resource: str,
    approval: Optional[ApprovalToken] = None,
) -> AuthorizationDecision:
    """Authorize only exact in-scope reads or explicitly approved writes.

    This pure function does not perform I/O, patch files, invoke tools, or
    authenticate a person. ApprovalToken is a policy input, not a secret.
    """
    try:
        operation = Operation(operation)
    except (TypeError, ValueError):
        return AuthorizationDecision(False, "unsupported_operation")

    if not isinstance(resource, str) or not resource.strip():
        return AuthorizationDecision(False, "invalid_resource")
    if resource not in policy.resources:
        return AuthorizationDecision(False, "out_of_scope")
    if operation is Operation.READ:
        return AuthorizationDecision(True, "in_scope_read")

    if approval is None:
        return AuthorizationDecision(
            False,
            "read_only_by_default" if policy.read_only else "approval_required",
        )
    if not isinstance(approval, ApprovalToken):
        return AuthorizationDecision(False, "approval_mismatch")
    try:
        approved_operation = Operation(approval.operation)
    except (TypeError, ValueError):
        return AuthorizationDecision(False, "approval_mismatch")
    if (
        not isinstance(approval.approved, bool)
        or not approval.approved
        or not isinstance(approval.token_id, str)
        or not approval.token_id.strip()
        or not isinstance(approval.approved_by, str)
        or not approval.approved_by.strip()
        or approved_operation is not operation
        or approval.resource != resource
    ):
        return AuthorizationDecision(False, "approval_mismatch")
    return AuthorizationDecision(True, "explicit_approval")
