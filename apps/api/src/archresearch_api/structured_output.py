from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

StructuredApiProtocol = Literal["responses", "chat_completions"]


@dataclass(frozen=True)
class StructuredResponse:
    output_parsed: Any


class ChatCompletionsResponsesAdapter:
    def __init__(self, raw_client: Any) -> None:
        self.raw_client = raw_client

    def parse(self, **kwargs: Any) -> StructuredResponse:
        if any(name in kwargs for name in ("tools", "tool_choice", "include")):
            raise ValueError("Chat Completions cannot emulate Responses web search tools")
        request: dict[str, Any] = {
            "model": kwargs["model"],
            "messages": _chat_messages(kwargs["input"]),
            "response_format": kwargs["text_format"],
        }
        if "max_output_tokens" in kwargs:
            request["max_tokens"] = kwargs["max_output_tokens"]
        if "timeout" in kwargs:
            request["timeout"] = kwargs["timeout"]
        completion = self.raw_client.chat.completions.parse(**request)
        choices = getattr(completion, "choices", [])
        parsed = choices[0].message.parsed if choices else None
        return StructuredResponse(output_parsed=parsed)


class ChatCompletionsClientAdapter:
    def __init__(self, raw_client: Any) -> None:
        self.raw_client = raw_client
        self.responses = ChatCompletionsResponsesAdapter(raw_client)


def adapt_structured_client(
    raw_client: Any,
    protocol: StructuredApiProtocol,
) -> Any:
    if protocol == "responses":
        return raw_client
    if protocol == "chat_completions":
        return ChatCompletionsClientAdapter(raw_client)
    raise ValueError(f"Unsupported structured API protocol: {protocol}")


def _chat_messages(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        return [{"role": "user", "content": value}]
    if not isinstance(value, list):
        raise ValueError("Structured input must be text or a message list")
    messages: list[dict[str, Any]] = []
    for message in value:
        if not isinstance(message, dict):
            raise ValueError("Structured message must be an object")
        role = message.get("role")
        content = message.get("content")
        if not isinstance(role, str):
            raise ValueError("Structured message role is required")
        messages.append({"role": role, "content": _chat_content(content)})
    return messages


def _chat_content(value: Any) -> Any:
    if isinstance(value, str):
        return value
    if not isinstance(value, list):
        raise ValueError("Structured message content must be text or a content list")
    content: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Structured content item must be an object")
        item_type = item.get("type")
        if item_type == "input_text" and isinstance(item.get("text"), str):
            content.append({"type": "text", "text": item["text"]})
            continue
        if item_type == "input_image" and isinstance(item.get("image_url"), str):
            image_url: dict[str, str] = {"url": item["image_url"]}
            if item.get("detail") in {"low", "high", "auto"}:
                image_url["detail"] = item["detail"]
            content.append({"type": "image_url", "image_url": image_url})
            continue
        raise ValueError("Unsupported structured content item")
    return content
