"""add run retention

Revision ID: c9e0f1a2b3c4
Revises: b8d9e0f1a2b3
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa

from alembic import op

revision: str = "c9e0f1a2b3c4"
down_revision: str | None = "b8d9e0f1a2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "keep_forever",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch_op.add_column(sa.Column("retention_expires_at", sa.DateTime(), nullable=True))
        batch_op.create_index(
            "ix_research_runs_retention_expires_at",
            ["retention_expires_at"],
            unique=False,
        )

    adoption_grace = datetime.now(UTC).replace(tzinfo=None) + timedelta(days=14)
    op.get_bind().execute(
        sa.text(
            "UPDATE research_runs SET retention_expires_at = :expires_at WHERE keep_forever = 0"
        ),
        {"expires_at": adoption_grace},
    )


def downgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.drop_index("ix_research_runs_retention_expires_at")
        batch_op.drop_column("retention_expires_at")
        batch_op.drop_column("keep_forever")
