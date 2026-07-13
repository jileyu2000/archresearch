"""add durable run budgets

Revision ID: a7c8d9e0f1a2
Revises: 9b4c5d6e7f80
Create Date: 2026-07-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7c8d9e0f1a2"
down_revision: str | None = "9b4c5d6e7f80"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("visual_calls_used", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(
            sa.Column("visual_bytes_used", sa.Integer(), server_default="0", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "visual_byte_limit_reached",
                sa.Boolean(),
                server_default=sa.false(),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column("browser_pages_attempted", sa.Integer(), server_default="0", nullable=False)
        )

    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("run_attempt", sa.Integer(), server_default="0", nullable=False)
        )


def downgrade() -> None:
    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.drop_column("run_attempt")

    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.drop_column("browser_pages_attempted")
        batch_op.drop_column("visual_byte_limit_reached")
        batch_op.drop_column("visual_bytes_used")
        batch_op.drop_column("visual_calls_used")
