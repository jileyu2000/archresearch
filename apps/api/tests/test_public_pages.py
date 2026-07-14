from __future__ import annotations

import json

import httpx
import pytest

from archresearch_api.public_pages import FirecrawlPageParser


def test_firecrawl_parser_requests_fresh_bounded_formats_and_maps_image_alts() -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "markdown": (
                        "# Courtyard Archive\n"
                        "![Longitudinal section](https://cdn.example/section.png)"
                    ),
                    "links": ["https://studio.example/about"],
                    "images": [
                        "https://cdn.example/section.png",
                        "https://cdn.example/plan.png",
                    ],
                    "metadata": {
                        "title": "Courtyard Archive",
                        "description": "Adaptive reuse project",
                        "sourceURL": "https://studio.example/project",
                    },
                },
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(respond))
    parser = FirecrawlPageParser(api_key="fc-secret", client=client)

    page = parser.parse("https://studio.example/project")

    assert page.title == "Courtyard Archive"
    assert page.images[0].model_dump() == {
        "url": "https://cdn.example/section.png",
        "alt": "Longitudinal section",
    }
    assert page.images[1].url == "https://cdn.example/plan.png"
    assert len(requests) == 1
    assert requests[0].url == "https://api.firecrawl.dev/v2/scrape"
    assert requests[0].headers["authorization"] == "Bearer fc-secret"
    assert json.loads(requests[0].content) == {
        "url": "https://studio.example/project",
        "formats": ["markdown", "links", "images"],
        "onlyMainContent": True,
        "maxAge": 0,
    }


def test_firecrawl_parser_rejects_private_input_and_filters_untrusted_output() -> None:
    calls = 0

    def respond(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json={
                "success": True,
                "data": {
                    "markdown": "M" * 20_000,
                    "links": [
                        "http://127.0.0.1/private",
                        *[f"https://e.test/{i}" for i in range(60)],
                    ],
                    "images": [
                        "http://192.168.1.2/private.png",
                        *[f"https://cdn.example/{i}.png" for i in range(60)],
                    ],
                    "metadata": {},
                },
            },
        )

    parser = FirecrawlPageParser(
        api_key="fc-secret",
        client=httpx.Client(transport=httpx.MockTransport(respond)),
    )

    with pytest.raises(ValueError, match="public HTTP"):
        parser.parse("http://127.0.0.1/private")
    assert calls == 0

    page = parser.parse("https://studio.example/project")
    assert len(page.markdown) == 12_000
    assert len(page.links) == 40
    assert len(page.images) == 40
    assert all("127.0.0.1" not in link for link in page.links)
    assert all("192.168.1.2" not in image.url for image in page.images)


def test_firecrawl_parser_rejects_unsuccessful_or_malformed_responses() -> None:
    responses = iter(
        [
            httpx.Response(200, json={"success": False}),
            httpx.Response(200, json={"success": True, "data": []}),
        ]
    )
    parser = FirecrawlPageParser(
        api_key="fc-secret",
        client=httpx.Client(
            transport=httpx.MockTransport(lambda _: next(responses)),
        ),
    )

    with pytest.raises(ValueError, match="successful scrape"):
        parser.parse("https://studio.example/one")
    with pytest.raises(ValueError, match="valid data"):
        parser.parse("https://studio.example/two")
