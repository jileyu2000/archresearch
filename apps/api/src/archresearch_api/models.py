from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )


class Workspace(TimestampMixin, Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    brief: Mapped[str] = mapped_column(Text, default="")
    constraints: Mapped[list[str]] = mapped_column(JSON, default=list)

    inputs: Mapped[list[InputArtifact]] = relationship(cascade="all, delete-orphan")
    runs: Mapped[list[ResearchRun]] = relationship(cascade="all, delete-orphan")
    saved_references: Mapped[list[SavedReference]] = relationship(cascade="all, delete-orphan")
    rejected_feedback: Mapped[list[RejectedFeedback]] = relationship(cascade="all, delete-orphan")


class InputArtifact(Base):
    __tablename__ = "input_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))
    url: Mapped[str | None] = mapped_column(Text)
    filename: Mapped[str | None] = mapped_column(String(500))
    mime_type: Mapped[str | None] = mapped_column(String(200))
    sha256: Mapped[str | None] = mapped_column(String(64))
    storage_path: Mapped[str | None] = mapped_column(Text)
    page_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ResearchRun(TimestampMixin, Base):
    __tablename__ = "research_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    question: Mapped[str] = mapped_column(Text)
    goal: Mapped[str] = mapped_column(String(50))
    budget_mode: Mapped[str] = mapped_column(String(20))
    budget: Mapped[dict[str, int]] = mapped_column(JSON)
    allowed_domains: Mapped[list[str]] = mapped_column(JSON, default=list)
    research_sources: Mapped[list[str]] = mapped_column(JSON, default=list)
    subquestions: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(30), default="created", index=True)
    checkpoint_stage: Mapped[str | None] = mapped_column(String(30))
    coverage_report: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    stop_reason: Mapped[str | None] = mapped_column(String(200))
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    visual_calls_used: Mapped[int] = mapped_column(Integer, default=0)
    visual_bytes_used: Mapped[int] = mapped_column(Integer, default=0)
    visual_byte_limit_reached: Mapped[bool] = mapped_column(Boolean, default=False)
    browser_pages_attempted: Mapped[int] = mapped_column(Integer, default=0)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    queries: Mapped[list[QueryAttempt]] = relationship(cascade="all, delete-orphan")
    pages: Mapped[list[SourcePage]] = relationship(cascade="all, delete-orphan")
    assets: Mapped[list[AssetCandidate]] = relationship(cascade="all, delete-orphan")
    board: Mapped[ReferenceBoard | None] = relationship(cascade="all, delete-orphan", uselist=False)
    trace_events: Mapped[list[TraceEvent]] = relationship(cascade="all, delete-orphan")


class QueryAttempt(Base):
    __tablename__ = "query_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE"), index=True
    )
    round_number: Mapped[int] = mapped_column(Integer)
    subquestion_id: Mapped[str | None] = mapped_column(String(64))
    run_attempt: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="started")
    query: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(10))
    purpose: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str] = mapped_column(String(100))
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class SourcePage(Base):
    __tablename__ = "source_pages"
    __table_args__ = (UniqueConstraint("run_id", "url", name="uq_source_page_run_url"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(Text)
    publisher: Mapped[str] = mapped_column(String(300), default="")
    title: Mapped[str] = mapped_column(String(500), default="")
    publication_tier: Mapped[str] = mapped_column(String(30), default="unknown")
    access_status: Mapped[str] = mapped_column(String(30), default="available")
    content_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class AssetCandidate(Base):
    __tablename__ = "asset_candidates"
    __table_args__ = (
        Index("ix_asset_run_rank", "run_id", "rank_index"),
        UniqueConstraint("run_id", "source_url", "image_url", name="uq_asset_run_source_image"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE"), index=True
    )
    source_page_id: Mapped[str | None] = mapped_column(
        ForeignKey("source_pages.id", ondelete="SET NULL")
    )
    project_name: Mapped[str] = mapped_column(String(500))
    asset_type: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(Text)
    perceptual_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    publication_tier: Mapped[str] = mapped_column(String(30), default="unknown")
    project_identity: Mapped[str] = mapped_column(String(30), default="unknown")
    asset_association: Mapped[str] = mapped_column(String(30), default="unknown")
    primary_source: Mapped[str] = mapped_column(String(30), default="unknown")
    rights_status: Mapped[str] = mapped_column(String(30), default="unknown")
    result_tier: Mapped[str] = mapped_column(String(30), default="visual_lead", index=True)
    relevance: Mapped[int] = mapped_column(Integer, default=0)
    subquestion_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    project_context: Mapped[str] = mapped_column(Text, default="")
    design_mechanism: Mapped[str] = mapped_column(Text, default="")
    transfer_strategy: Mapped[list[str]] = mapped_column(JSON, default=list)
    subquestion_analysis: Mapped[dict[str, dict[str, Any]]] = mapped_column(JSON, default=dict)
    facts: Mapped[list[str]] = mapped_column(JSON, default=list)
    observations: Mapped[list[str]] = mapped_column(JSON, default=list)
    inferences: Mapped[list[str]] = mapped_column(JSON, default=list)
    limitations: Mapped[list[str]] = mapped_column(JSON, default=list)
    rank_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    evidence_claims: Mapped[list[EvidenceClaim]] = relationship(
        cascade="all, delete-orphan", order_by="EvidenceClaim.created_at"
    )

    @property
    def has_local_content(self) -> bool:
        return bool(self.storage_path)


class EvidenceClaim(Base):
    __tablename__ = "evidence_claims"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    asset_candidate_id: Mapped[str] = mapped_column(
        ForeignKey("asset_candidates.id", ondelete="CASCADE"), index=True
    )
    claim_type: Mapped[str] = mapped_column(String(30))
    statement: Mapped[str] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    pdf_page: Mapped[int | None] = mapped_column(Integer)
    text_excerpt: Mapped[str | None] = mapped_column(Text)
    image_region: Mapped[dict[str, float] | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class SavedReference(Base):
    __tablename__ = "saved_references"
    __table_args__ = (
        UniqueConstraint("workspace_id", "asset_candidate_id", name="uq_saved_workspace_asset"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    asset_candidate_id: Mapped[str] = mapped_column(String(36))
    source_url: Mapped[str] = mapped_column(Text)
    note: Mapped[str] = mapped_column(Text, default="")
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class RejectedFeedback(Base):
    __tablename__ = "rejected_feedback"
    __table_args__ = (
        UniqueConstraint("workspace_id", "asset_candidate_id", name="uq_rejected_workspace_asset"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    asset_candidate_id: Mapped[str] = mapped_column(String(36))
    source_url: Mapped[str] = mapped_column(Text)
    perceptual_hash: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ReferenceBoard(TimestampMixin, Base):
    __tablename__ = "reference_boards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE"), unique=True, index=True
    )
    selected_asset_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    layout: Mapped[str] = mapped_column(String(30), default="grid")
    notes: Mapped[str] = mapped_column(Text, default="")
    style_profile: Mapped[StyleProfile | None] = relationship(
        cascade="all, delete-orphan", uselist=False
    )


class StyleProfile(TimestampMixin, Base):
    __tablename__ = "style_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    board_id: Mapped[str] = mapped_column(
        ForeignKey("reference_boards.id", ondelete="CASCADE"), unique=True, index=True
    )
    palette: Mapped[list[str]] = mapped_column(JSON, default=list)
    line_weights: Mapped[dict[str, float]] = mapped_column(JSON, default=dict)
    texture: Mapped[str] = mapped_column(String(200), default="")
    font_category: Mapped[str] = mapped_column(String(200), default="")
    layout_notes: Mapped[str] = mapped_column(Text, default="")


class TraceEvent(Base):
    __tablename__ = "trace_events"
    __table_args__ = (UniqueConstraint("run_id", "sequence", name="uq_trace_run_sequence"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("research_runs.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer)
    stage: Mapped[str] = mapped_column(String(30), index=True)
    tool: Mapped[str] = mapped_column(String(100), default="workflow")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
