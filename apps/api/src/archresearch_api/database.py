from collections.abc import Iterator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


class Database:
    def __init__(self, url: str) -> None:
        connect_args: dict[str, Any] = (
            {"check_same_thread": False} if url.startswith("sqlite") else {}
        )
        self.engine = create_engine(url, connect_args=connect_args)
        if url.startswith("sqlite"):
            event.listen(self.engine, "connect", _enable_sqlite_foreign_keys)
        self.session_factory = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def sessions(self) -> Iterator[Session]:
        with self.session_factory() as session:
            yield session


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
