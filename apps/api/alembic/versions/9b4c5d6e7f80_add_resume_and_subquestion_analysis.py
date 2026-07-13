"""add resume and subquestion analysis fields

Revision ID: 9b4c5d6e7f80
Revises: 8f3b1c2d4e5f
Create Date: 2026-07-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "9b4c5d6e7f80"
down_revision: str | None = "8f3b1c2d4e5f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(length=30), server_default="started", nullable=False)
        )

    with op.batch_alter_table("asset_candidates", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "subquestion_analysis",
                sa.JSON(),
                server_default=sa.text("'{}'"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("asset_candidates", schema=None) as batch_op:
        batch_op.drop_column("subquestion_analysis")

    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.drop_column("status")
