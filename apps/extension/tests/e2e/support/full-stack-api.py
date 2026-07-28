from __future__ import annotations

import argparse
from pathlib import Path

import uvicorn
from archresearch_api.browser import BrowserBroker
from archresearch_api.config import Settings
from archresearch_api.main import create_app
from archresearch_api.providers import ProviderSearchResult, ProviderSource
from archresearch_api.schemas import PublicationTier, ResearchGoal
from archresearch_api.visual import MockVisualClassifier


class FixtureResearchProvider:
    name = "fixture"

    def __init__(self, source_url: str) -> None:
        self.source_url = source_url

    def search(
        self,
        query: str,
        goal: ResearchGoal,
        allowed_domains: list[str] | None = None,
    ) -> ProviderSearchResult:
        del query, goal, allowed_domains
        return ProviderSearchResult(
            assets=[],
            sources=[
                ProviderSource(
                    url=self.source_url,
                    publisher="Fixture Architecture Review",
                    title="Courtyard Archive",
                    publication_tier=PublicationTier.primary,
                )
            ],
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--source-url", required=True)
    arguments = parser.parse_args()
    settings = Settings(
        database_url=f"sqlite:///{(arguments.data_dir / 'e2e.db').as_posix()}",
        data_dir=arguments.data_dir,
        provider_mode="mock",
        run_inline=True,
    )
    broker = BrowserBroker(
        hostname_resolver=lambda hostname: (
            ["93.184.216.34"] if hostname == "archresearch.test" else []
        )
    )
    app = create_app(
        settings,
        research_provider=FixtureResearchProvider(arguments.source_url),
        browser_broker=broker,
        visual_classifier=MockVisualClassifier(),
    )
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=arguments.port, log_level="warning")
    )

    @app.post("/__e2e__/shutdown", include_in_schema=False)
    async def shutdown() -> dict[str, str]:
        server.should_exit = True
        return {"status": "stopping"}

    server.run()


if __name__ == "__main__":
    main()
