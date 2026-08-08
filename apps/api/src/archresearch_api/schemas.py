from __future__ import annotations

import ipaddress
import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .visual import ArchitectureAssetType

RECORD_TITLE_MAX_LENGTH = 28
_RECORD_TITLE_LEAD = re.compile(
    r"^(?:我想问的问题是|我想问的是|我的问题是|问题是|请问)\s*[：:，,]?\s*"
)
_RECORD_TITLE_SPLIT = re.compile(
    r"(?:[，,；;：:]\s*)?(?:(?:该|应|应该|应当|要|可以)\s*)?(?:如何|怎样|怎么)"
)


def research_record_title(question: str) -> str:
    text = " ".join(question.split())
    text = _RECORD_TITLE_LEAD.sub("", text).strip(" ：:，,。.!！?？；;")
    question_clauses = [
        clause.strip(" ：:，,。.!！?？；;")
        for clause in re.split(r"[?？]+", text)
        if clause.strip(" ：:，,。.!！?？；;")
    ]
    if len(question_clauses) > 1:
        text = question_clauses[-1]
    split = _RECORD_TITLE_SPLIT.search(text)
    if split is not None:
        context = text[: split.start()].strip(" ，,。.!！?？；;")
        action = text[split.end() :].strip(" ，,。.!！?？；;")
        action = re.sub(r"[呢吗呀吧]$", "", action)
        if context and action:
            first_clause = re.split(r"[，,；;]", context, maxsplit=1)[0]
            subject = re.match(r"^(.{2,12}?)(?:是|作为)", first_clause)
            context = subject.group(1) if subject else first_clause
            text = f"{context}：{action}"
    if len(text) > RECORD_TITLE_MAX_LENGTH:
        prefix = text[: RECORD_TITLE_MAX_LENGTH - 1].rstrip(" 的与和及、，：:；;–-")
        return f"{prefix}…"
    return text or "未命名研究"


class ResearchGoal(StrEnum):
    precedent_research = "precedent_research"
    visual_reference_search = "visual_reference_search"


class BudgetMode(StrEnum):
    quick = "quick"
    balanced = "balanced"
    deep = "deep"


class ResearchSource(StrEnum):
    xiaohongshu = "xiaohongshu"


class RunStatus(StrEnum):
    created = "created"
    planning = "planning"
    searching = "searching"
    inspecting = "inspecting"
    analyzing = "analyzing"
    verifying = "verifying"
    gap_check = "gap_check"
    composing = "composing"
    completed = "completed"
    partial = "partial"
    blocked = "blocked"
    cancelled = "cancelled"
    failed = "failed"


class PublicationTier(StrEnum):
    primary = "primary"
    trusted_secondary = "trusted_secondary"
    aggregator = "aggregator"
    unknown = "unknown"


class AssociationStatus(StrEnum):
    confirmed = "confirmed"
    probable = "probable"
    unknown = "unknown"
    conflict = "conflict"


class PrimarySourceStatus(StrEnum):
    confirmed = "confirmed"
    candidate = "candidate"
    unknown = "unknown"


class RightsStatus(StrEnum):
    user_owned = "user_owned"
    open_license = "open_license"
    permissioned = "permissioned"
    unknown = "unknown"
    restricted = "restricted"


class ResultTier(StrEnum):
    verified = "verified"
    partial = "partial"
    visual_lead = "visual_lead"


class ArtifactKind(StrEnum):
    image = "image"
    pdf = "pdf"
    url = "url"


class Budget(BaseModel):
    max_rounds: int
    max_queries: int
    completion_recovery_rounds: int = 4
    completion_recovery_pages_per_subquestion: int = 3
    max_pages: int
    max_seconds: int


class DepthTarget(BaseModel):
    subquestions: int
    research_passes: int
    assets_per_subquestion: int
    analysis_requirements: list[str]
    projects: int
    assets: int
    multi_asset_projects: int
    verified_or_partial: int


BUDGETS: dict[BudgetMode, Budget] = {
    BudgetMode.quick: Budget(
        max_rounds=2,
        max_queries=8,
        completion_recovery_rounds=5,
        completion_recovery_pages_per_subquestion=4,
        max_pages=20,
        max_seconds=2880,
    ),
    BudgetMode.balanced: Budget(
        max_rounds=3,
        max_queries=15,
        completion_recovery_rounds=5,
        completion_recovery_pages_per_subquestion=4,
        max_pages=48,
        max_seconds=4320,
    ),
    BudgetMode.deep: Budget(
        max_rounds=4,
        max_queries=30,
        completion_recovery_rounds=5,
        completion_recovery_pages_per_subquestion=4,
        max_pages=90,
        max_seconds=6480,
    ),
}


DEPTH_TARGETS: dict[BudgetMode, DepthTarget] = {
    BudgetMode.quick: DepthTarget(
        subquestions=3,
        research_passes=2,
        assets_per_subquestion=2,
        analysis_requirements=["visible_observation", "design_mechanism"],
        projects=2,
        assets=6,
        multi_asset_projects=0,
        verified_or_partial=4,
    ),
    BudgetMode.balanced: DepthTarget(
        subquestions=4,
        research_passes=3,
        assets_per_subquestion=3,
        analysis_requirements=[
            "visible_observation",
            "design_mechanism",
            "transfer_strategy",
            "applicability_boundary",
        ],
        projects=4,
        assets=12,
        multi_asset_projects=2,
        verified_or_partial=6,
    ),
    BudgetMode.deep: DepthTarget(
        subquestions=6,
        research_passes=4,
        assets_per_subquestion=3,
        analysis_requirements=[
            "visible_observation",
            "design_mechanism",
            "transfer_strategy",
            "applicability_boundary",
            "source_verification",
            "cross_case_comparison",
        ],
        projects=6,
        assets=18,
        multi_asset_projects=3,
        verified_or_partial=9,
    ),
}


class ResearchSubquestion(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]{1,63}$")
    question: str = Field(min_length=3, max_length=500)
    rationale: str = Field(min_length=3, max_length=1_000)


class ResearchPlan(BaseModel):
    project_summary: str = Field(default="", max_length=2_000)
    project_boundaries: list[str] = Field(default_factory=list, max_length=6)
    subquestions: list[ResearchSubquestion] = Field(min_length=3, max_length=6)

    @model_validator(mode="after")
    def require_unique_subquestions(self) -> ResearchPlan:
        ids = [item.id for item in self.subquestions]
        if len(ids) != len(set(ids)):
            raise ValueError("Research subquestion ids must be unique")
        return self


class ResearchSpec(BaseModel):
    question: str = Field(min_length=3, max_length=4_000)
    goal: ResearchGoal = ResearchGoal.precedent_research
    budget_mode: BudgetMode = BudgetMode.balanced
    allowed_domains: list[str] = Field(default_factory=list, max_length=20)
    research_sources: list[ResearchSource] = Field(
        default_factory=list,
        max_length=5,
    )
    subquestions: list[ResearchSubquestion] | None = Field(
        default=None,
        min_length=3,
        max_length=6,
    )

    @model_validator(mode="after")
    def require_goal_specific_research_sources(self) -> ResearchSpec:
        if self.goal is ResearchGoal.precedent_research and self.research_sources:
            raise ValueError("Precedent research does not accept visual platform sources")
        return self

    @model_validator(mode="after")
    def require_complete_confirmed_question_directory(self) -> ResearchSpec:
        if self.subquestions is None:
            return self
        expected = DEPTH_TARGETS[self.budget_mode].subquestions
        if len(self.subquestions) != expected:
            raise ValueError(
                f"Confirmed question directory must contain exactly {expected} questions"
            )
        ids = [item.id for item in self.subquestions]
        if len(ids) != len(set(ids)):
            raise ValueError("Confirmed question directory ids must be unique")
        return self


class ProjectBriefReviewRead(BaseModel):
    filename: str
    page_count: int = Field(ge=1)
    project_summary: str = Field(min_length=1, max_length=2_000)
    project_boundaries: list[str] = Field(min_length=1, max_length=6)
    subquestions: list[ResearchSubquestion] = Field(min_length=3, max_length=6)


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brief: str = Field(default="", max_length=20_000)
    constraints: list[str] = Field(default_factory=list, max_length=100)


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    brief: str | None = Field(default=None, max_length=20_000)
    constraints: list[str] | None = Field(default=None, max_length=100)
    archived_at: datetime | None = None


class WorkspaceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    brief: str
    constraints: list[str]
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UrlInputCreate(BaseModel):
    url: str = Field(max_length=4_000)

    @model_validator(mode="after")
    def validate_public_http_url(self) -> UrlInputCreate:
        parsed = urlparse(self.url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
            raise ValueError("Only public HTTP(S) URLs are allowed")
        hostname = parsed.hostname.rstrip(".").lower()
        if hostname == "localhost" or hostname.endswith(".localhost"):
            raise ValueError("Local URLs are not allowed")
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            return self
        if not address.is_global:
            raise ValueError("Private or reserved IP addresses are not allowed")
        return self


class InputArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    kind: ArtifactKind
    url: str | None
    filename: str | None
    mime_type: str | None
    sha256: str | None
    storage_path: str | None
    page_count: int | None
    created_at: datetime


class WorkspaceBackupPreflightRead(BaseModel):
    ready: bool
    format_version: int
    schema_revision: str
    file_count: int
    total_bytes: int
    categories: dict[str, int]
    workspace_count: int
    run_count: int
    collection_count: int
    input_artifact_count: int


class WorkspaceRestoreRead(WorkspaceBackupPreflightRead):
    restored: bool
    rollback_backup: str


class CoverageReport(BaseModel):
    usable_assets: int = 0
    project_count: int = 0
    verified_or_partial: int = 0
    subquestion_count: int = 0
    covered_subquestions: int = 0
    multi_asset_projects: int = 0
    gaps: list[str] = Field(default_factory=list)
    enrichment_gaps: list[str] = Field(default_factory=list)


class ResearchRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    question: str
    title: str = ""
    goal: ResearchGoal
    budget_mode: BudgetMode
    budget: dict[str, int]
    research_sources: list[ResearchSource]
    subquestions: list[ResearchSubquestion]
    status: RunStatus
    checkpoint_stage: str | None
    coverage_report: dict[str, Any]
    stop_reason: str | None
    attempt: int
    keep_forever: bool
    retention_expires_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def derive_title_from_question(self) -> ResearchRunRead:
        self.title = research_record_title(self.question)
        return self

    @field_validator("retention_expires_at", mode="before")
    @classmethod
    def attach_utc_to_retention_expiry(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class RunRetentionUpdate(BaseModel):
    permanent: bool


ClaimType = Literal["fact", "observation", "inference", "limitation"]


class EvidenceClaimCreate(BaseModel):
    claim_type: ClaimType
    statement: str = Field(min_length=1, max_length=4_000)
    source_url: str | None = None
    pdf_page: int | None = Field(default=None, ge=1)
    text_excerpt: str | None = Field(default=None, max_length=2_000)
    image_region: dict[str, float] | None = None

    @model_validator(mode="after")
    def require_locator_for_fact(self) -> EvidenceClaimCreate:
        if self.claim_type == "fact" and not (self.source_url or self.pdf_page):
            raise ValueError("Formal facts require a URL or PDF page locator")
        return self


class EvidenceClaimRead(EvidenceClaimCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    asset_candidate_id: str
    created_at: datetime


class SubquestionAssetAnalysis(BaseModel):
    project_name_zh: str = ""
    project_context: str = ""
    design_mechanism: str = ""
    transfer_strategy: list[str] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class AssetCandidateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    project_name: str
    asset_type: ArchitectureAssetType
    has_local_content: bool
    source_url: str
    image_url: str | None
    publication_tier: PublicationTier
    project_identity: AssociationStatus
    asset_association: AssociationStatus
    primary_source: PrimarySourceStatus
    rights_status: RightsStatus
    result_tier: ResultTier
    relevance: int
    subquestion_ids: list[str]
    project_context: str
    design_mechanism: str
    transfer_strategy: list[str]
    subquestion_analysis: dict[str, SubquestionAssetAnalysis]
    facts: list[str]
    observations: list[str]
    inferences: list[str]
    limitations: list[str]
    rank_index: int
    evidence_claims: list[EvidenceClaimRead]

    @field_validator("asset_type", mode="before")
    @classmethod
    def normalize_legacy_asset_type(cls, value: object) -> ArchitectureAssetType:
        if isinstance(value, ArchitectureAssetType):
            return value
        if not isinstance(value, str):
            return ArchitectureAssetType.photograph
        try:
            return ArchitectureAssetType(value)
        except ValueError:
            pass

        normalized = value.casefold().replace("_", " ")
        aliases = {
            ArchitectureAssetType.plan: ("plan", "平面"),
            ArchitectureAssetType.section: ("section", "剖面"),
            ArchitectureAssetType.elevation: ("elevation", "立面"),
            ArchitectureAssetType.site_plan: ("site plan", "总平面", "场地平面"),
            ArchitectureAssetType.axonometric: ("axonometric", "isometric", "轴测"),
            ArchitectureAssetType.circulation: ("circulation", "流线"),
            ArchitectureAssetType.analysis_diagram: ("analysis", "diagram", "分析图"),
            ArchitectureAssetType.render: ("render", "效果图"),
            ArchitectureAssetType.photograph: ("photo", "photograph", "照片", "摄影"),
        }
        matches = {
            asset_type
            for asset_type, keywords in aliases.items()
            if any(keyword in normalized for keyword in keywords)
        }
        if ArchitectureAssetType.site_plan in matches:
            matches.discard(ArchitectureAssetType.plan)
        if len(matches) == 1:
            return matches.pop()
        if matches:
            return ArchitectureAssetType.analysis_diagram
        return ArchitectureAssetType.photograph


class SaveCreate(BaseModel):
    note: str = Field(default="", max_length=4_000)
    subquestion_ids: list[str] | None = Field(default=None, max_length=6)


class SavedReferenceCaseEvidence(BaseModel):
    statement: str
    text_excerpt: str
    source_url: str | None = None


class SavedReferenceCaseImage(BaseModel):
    asset_id: str
    asset_type: ArchitectureAssetType
    image_url: str
    source_url: str


class SavedReferenceCaseSubquestion(BaseModel):
    id: str
    question: str
    project_name_zh: str = ""
    project_context: str = ""
    design_mechanism: str = ""
    transfer_strategy: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    evidence: SavedReferenceCaseEvidence | None = None


class SavedReferenceSnapshot(BaseModel):
    model_config = ConfigDict(extra="allow")

    question: str | None = None
    goal: ResearchGoal | None = None
    project_name: str | None = None
    asset_type: ArchitectureAssetType | None = None
    image_url: str | None = None
    collection_file: str | None = None
    result_tier: str | None = None
    rights_status: str | None = None
    visual_observation: str = ""
    project_context: str = ""
    design_mechanism: str = ""
    transfer_strategy: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    visual_directions: list[str] = Field(default_factory=list)
    case_images: list[SavedReferenceCaseImage] = Field(default_factory=list)
    case_subquestions: list[SavedReferenceCaseSubquestion] = Field(default_factory=list)


class SavedReferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    asset_candidate_id: str
    source_url: str
    note: str
    snapshot: SavedReferenceSnapshot
    created_at: datetime


class RejectCreate(BaseModel):
    reason: str = Field(min_length=1, max_length=2_000)


class RejectedFeedbackRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    asset_candidate_id: str
    source_url: str
    perceptual_hash: str | None
    reason: str
    created_at: datetime


class SavedUserState(BaseModel):
    asset_candidate_id: str
    note: str


class RejectedUserState(BaseModel):
    asset_candidate_id: str
    reason: str


class RunUserStateRead(BaseModel):
    saved: list[SavedUserState]
    rejected: list[RejectedUserState]


class BoardUpdate(BaseModel):
    selected_asset_ids: list[str] | None = None
    layout: Literal["grid", "columns", "sequence"] | None = None
    notes: str | None = Field(default=None, max_length=10_000)

    @model_validator(mode="after")
    def validate_comparison_size(self) -> BoardUpdate:
        if self.selected_asset_ids is not None and len(self.selected_asset_ids) > 6:
            raise ValueError("A comparison board cannot contain more than 6 assets")
        return self


class ReferenceBoardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    selected_asset_ids: list[str]
    layout: str
    notes: str
    created_at: datetime
    updated_at: datetime


class ExportCreate(BaseModel):
    mode: Literal["private", "share"]


class ExportRead(BaseModel):
    id: str
    board_id: str
    mode: Literal["private", "share"]
    path: str
    browser_url: str
    manifest_path: str
    item_count: int


class StyleProfileCreate(BaseModel):
    palette: list[str] = Field(default_factory=list, max_length=20)
    line_weights: dict[str, float] = Field(default_factory=dict)
    texture: str = Field(default="", max_length=200)
    font_category: str = Field(default="", max_length=200)
    layout_notes: str = Field(default="", max_length=4_000)


class StyleProfileUpdate(BaseModel):
    palette: list[str] | None = Field(default=None, max_length=20)
    line_weights: dict[str, float] | None = None
    texture: str | None = Field(default=None, max_length=200)
    font_category: str | None = Field(default=None, max_length=200)
    layout_notes: str | None = Field(default=None, max_length=4_000)


class StyleProfileRead(StyleProfileCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    board_id: str
    created_at: datetime
    updated_at: datetime
