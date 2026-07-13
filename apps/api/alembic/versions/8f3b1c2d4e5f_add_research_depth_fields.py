"""add research depth fields

Revision ID: 8f3b1c2d4e5f
Revises: ff58c6bc93c7
Create Date: 2026-07-13 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "8f3b1c2d4e5f"
down_revision: str | None = "ff58c6bc93c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("subquestions", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
        )

    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.add_column(sa.Column("subquestion_id", sa.String(length=64), nullable=True))

    with op.batch_alter_table("asset_candidates", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("subquestion_ids", sa.JSON(), server_default=sa.text("'[]'"), nullable=False)
        )
        batch_op.add_column(
            sa.Column("project_context", sa.Text(), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column("design_mechanism", sa.Text(), server_default="", nullable=False)
        )
        batch_op.add_column(
            sa.Column(
                "transfer_strategy", sa.JSON(), server_default=sa.text("'[]'"), nullable=False
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("asset_candidates", schema=None) as batch_op:
        batch_op.drop_column("transfer_strategy")
        batch_op.drop_column("design_mechanism")
        batch_op.drop_column("project_context")
        batch_op.drop_column("subquestion_ids")

    with op.batch_alter_table("query_attempts", schema=None) as batch_op:
        batch_op.drop_column("subquestion_id")

    with op.batch_alter_table("research_runs", schema=None) as batch_op:
        batch_op.drop_column("subquestions")
