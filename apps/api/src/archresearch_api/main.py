from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401
from .api import execute_reserved_research_run, router
from .browser import BrowserBroker, PairingAuthority, create_browser_router
from .config import Settings
from .database import Database
from .lifecycle import cleanup_expired_data, incomplete_run_ids
from .provider_credentials import (
    KeyringBackend,
    ProviderRuntime,
    get_windows_keyring,
    load_provider_config,
    load_provider_runtime,
)
from .providers import (
    OPENAI_MAX_RETRIES,
    OPENAI_REQUEST_TIMEOUT_SECONDS,
    MockResearchProvider,
    OpenAIResearchProvider,
    ResearchProvider,
)
from .public_pages import LocalBrowserPageParser, PublicPageParser
from .run_gate import ResearchRunGate
from .structured_output import adapt_structured_client
from .visual import MockVisualClassifier, OpenAIVisualClassifier, VisualClassifier
from .xiaohongshu import OpenCliXiaohongshuSearch, XiaohongshuSearch


def create_app(
    settings: Settings | None = None,
    *,
    research_provider: ResearchProvider | None = None,
    browser_broker: BrowserBroker | None = None,
    visual_classifier: VisualClassifier | None = None,
    public_page_parser: PublicPageParser | None = None,
    xiaohongshu_search: XiaohongshuSearch | None = None,
    chrome_launcher: Callable[[str], bool] | None = None,
    keyring_backend: KeyringBackend | None = None,
    openai_client_factory: Callable[..., Any] | None = None,
) -> FastAPI:
    resolved_settings = settings or Settings()
    database = Database(resolved_settings.database_url)
    browser_authority = PairingAuthority(resolved_settings.data_dir)
    resolved_browser_broker = browser_broker or BrowserBroker()
    run_gate = ResearchRunGate()
    browser_router = create_browser_router(
        browser_authority,
        resolved_browser_broker,
        chrome_launcher=chrome_launcher,
    )
    stored_runtime: ProviderRuntime | None = None
    if load_provider_config(resolved_settings.data_dir) is not None:
        try:
            credential_backend = keyring_backend or get_windows_keyring()
            stored_runtime = load_provider_runtime(
                resolved_settings.data_dir,
                credential_backend,
            )
        except Exception:
            stored_runtime = None
    shared_client: Any | None = None
    if stored_runtime is not None:
        if openai_client_factory is None:
            from openai import OpenAI

            openai_client_factory = OpenAI
        raw_client = openai_client_factory(
            api_key=stored_runtime.api_key,
            base_url=str(stored_runtime.config.base_url).rstrip("/"),
            timeout=OPENAI_REQUEST_TIMEOUT_SECONDS,
            max_retries=OPENAI_MAX_RETRIES,
        )
        shared_client = adapt_structured_client(
            raw_client,
            stored_runtime.config.api_protocol,
        )
    provider = research_provider
    if provider is None:
        if stored_runtime is not None:
            provider = OpenAIResearchProvider(
                api_key=None,
                model=stored_runtime.config.research_model,
                client=shared_client,
            )
        else:
            provider = (
                MockResearchProvider()
                if resolved_settings.provider_mode == "mock"
                else OpenAIResearchProvider(
                    api_key=resolved_settings.openai_api_key,
                    model=resolved_settings.openai_model,
                )
            )
    resolved_visual_classifier = visual_classifier
    if resolved_visual_classifier is None:
        if stored_runtime is not None:
            resolved_visual_classifier = OpenAIVisualClassifier(
                api_key=None,
                model=stored_runtime.config.vision_model,
                client=shared_client,
            )
        else:
            resolved_visual_classifier = (
                MockVisualClassifier()
                if resolved_settings.provider_mode == "mock"
                else OpenAIVisualClassifier(
                    api_key=resolved_settings.openai_api_key,
                    model=resolved_settings.vision_model,
                )
            )
    resolved_public_page_parser = public_page_parser
    if resolved_public_page_parser is None and (
        stored_runtime is not None or resolved_settings.provider_mode == "openai"
    ):
        resolved_public_page_parser = LocalBrowserPageParser()
    resolved_xiaohongshu_search = xiaohongshu_search
    if resolved_xiaohongshu_search is None and (
        stored_runtime is not None or resolved_settings.provider_mode == "openai"
    ):
        resolved_xiaohongshu_search = OpenCliXiaohongshuSearch.discover()

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        resolved_settings.data_dir.mkdir(parents=True, exist_ok=True)
        database.migrate()
        resolved_browser_broker.bind_loop()
        cleanup_expired_data(
            database,
            data_dir=resolved_settings.data_dir,
            metadata_ttl_days=resolved_settings.run_metadata_ttl_days,
        )

        async def resume_run(run_id: str) -> None:
            if not run_gate.reserve(run_id):
                return
            await asyncio.to_thread(
                execute_reserved_research_run,
                run_gate,
                database,
                run_id,
                provider,
                resolved_browser_broker.notify_terminal,
                browser_client=resolved_browser_broker,
                visual_classifier=resolved_visual_classifier,
                candidate_root=resolved_settings.data_dir / "runs",
                public_page_parser=resolved_public_page_parser,
                xiaohongshu_search=resolved_xiaohongshu_search,
            )

        run_ids = incomplete_run_ids(database)
        resume_tasks: list[asyncio.Task[None]] = []
        if resolved_settings.run_inline:
            for run_id in run_ids:
                await resume_run(run_id)
        else:

            async def resume_runs() -> None:
                for run_id in run_ids:
                    await resume_run(run_id)

            if run_ids:
                resume_tasks = [asyncio.create_task(resume_runs())]
        try:
            yield
        finally:
            completed = [task for task in resume_tasks if task.done()]
            for task in completed:
                task.result()
            database.engine.dispose()

    app = FastAPI(
        title="ArchResearch API",
        version="2.2.3",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.database = database
    app.state.research_provider = provider
    app.state.browser_broker = resolved_browser_broker
    app.state.visual_classifier = resolved_visual_classifier
    app.state.public_page_parser = resolved_public_page_parser
    app.state.xiaohongshu_search = resolved_xiaohongshu_search
    app.state.run_gate = run_gate
    app.state.data_maintenance = False
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["content-type"],
    )
    app.include_router(router)
    app.include_router(browser_router)

    @app.get("/health")
    def health() -> dict[str, str]:
        if stored_runtime is None:
            return {"status": "ok", "provider_mode": resolved_settings.provider_mode}
        return {
            "status": "ok",
            "provider_mode": "openai",
            "provider": stored_runtime.config.name,
            "model": stored_runtime.config.research_model,
        }

    return app


app = create_app()
