from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from pydantic import BaseModel

from archresearch_api.structured_output import adapt_structured_client


class OutputPayload(BaseModel):
    status: str


def test_chat_completions_adapter_converts_responses_text_and_image_inputs() -> None:
    requests: list[dict[str, Any]] = []

    class ChatCompletions:
        def parse(self, **kwargs: Any) -> Any:
            requests.append(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(parsed=OutputPayload(status="ok")))
                ]
            )

    raw_client = SimpleNamespace(
        chat=SimpleNamespace(completions=ChatCompletions()),
    )
    client = adapt_structured_client(raw_client, "chat_completions")

    response = client.responses.parse(
        model="moonshot-v1-8k-vision-preview",
        reasoning={"effort": "medium"},
        max_output_tokens=128,
        timeout=15.0,
        input=[
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": "Inspect the image."},
                    {
                        "type": "input_image",
                        "image_url": "data:image/png;base64,AAAA",
                        "detail": "low",
                    },
                ],
            }
        ],
        text_format=OutputPayload,
    )

    assert response.output_parsed == OutputPayload(status="ok")
    assert requests == [
        {
            "model": "moonshot-v1-8k-vision-preview",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Inspect the image."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64,AAAA",
                                "detail": "low",
                            },
                        },
                    ],
                }
            ],
            "response_format": OutputPayload,
            "max_tokens": 128,
            "timeout": 15.0,
        }
    ]


def test_responses_protocol_keeps_the_original_client() -> None:
    raw_client = object()

    assert adapt_structured_client(raw_client, "responses") is raw_client


def test_chat_completions_adapter_converts_plain_text_input() -> None:
    requests: list[dict[str, Any]] = []

    class ChatCompletions:
        def parse(self, **kwargs: Any) -> Any:
            requests.append(kwargs)
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(message=SimpleNamespace(parsed=OutputPayload(status="ok")))
                ]
            )

    client = adapt_structured_client(
        SimpleNamespace(chat=SimpleNamespace(completions=ChatCompletions())),
        "chat_completions",
    )

    client.responses.parse(
        model="deepseek-chat",
        input="Plan the research.",
        text_format=OutputPayload,
    )

    assert requests[0]["messages"] == [{"role": "user", "content": "Plan the research."}]
