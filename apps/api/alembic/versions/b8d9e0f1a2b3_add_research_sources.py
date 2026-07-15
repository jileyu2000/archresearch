"""add explicit research sources

Revision ID: b8d9e0f1a2b3
Revises: a7c8d9e0f1a2
Create Date: 2026-07-15 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b8d9e0f1a2b3"
down_revision: str | None = "a7c8d9e0f1a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "research_sources",
                sa.JSON(),
                server_default=sa.text("'[]'"),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.drop_column("research_sources")
