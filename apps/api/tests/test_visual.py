from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from archresearch_api.visual import (
    ArchitectureAssetType,
    MockVisualClassifier,
    OpenAIVisualClassifier,
    VisualClassification,
)


def test_visual_classification_is_strict_and_uses_only_the_nine_asset_types() -> None:
    assert {item.value for item in ArchitectureAssetType} == {
        "plan",
        "section",
        "elevation",
        "site_plan",
        "axonometric",
        "circulation",
        "analysis_diagram",
        "render",
        "photograph",
    }

    with pytest.raises(ValidationError):
        VisualClassification(
            asset_type="perspective",  # type: ignore[arg-type]
            relevance=3,
            observations=["Visible massing."],
        )
    with pytest.raises(ValidationError):
        VisualClassification.model_validate(
            {
                "asset_type": "plan",
                "relevance": 5,
                "observations": ["Visible rooms."],
            }
        )
    with pytest.raises(ValidationError):
        VisualClassification.model_validate(
            {
                "asset_type": "plan",
                "relevance": 4,
                "observations": ["Visible rooms."],
                "facts": ["Unsupported project fact."],
            }
        )


def test_mock_visual_classifier_is_deterministic() -> None:
    classifier = MockVisualClassifier()

    first = classifier.classify(
        "data:image/png;base64,ZmFrZQ==",
        question="如何形成有层次的剖面？",
        caption="Longitudinal section through the existing hall",
        project_text="Adaptive reuse project",
    )
    second = classifier.classify(
        "data:image/png;base64,ZmFrZQ==",
        question="如何形成有层次的剖面？",
        caption="Longitudinal section through the existing hall",
        project_text="Adaptive reuse project",
    )

    assert first == second
    assert first.asset_type is ArchitectureAssetType.section
    assert first.relevance == 4
    assert first.observations


def test_openai_visual_classifier_sends_only_bounded_text_and_the_crop() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(
                output_parsed=VisualClassification(
                    asset_type=ArchitectureAssetType.plan,
                    relevance=4,
                    observations=["可见房间、墙体与交通核。"],
                )
            )

    crop = "data:image/png;base64,ZmFrZS1jcm9w"
    classifier = OpenAIVisualClassifier(
        api_key=None,
        model="gpt-5.4-mini",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    result = classifier.classify(
        crop,
        question="Q" * 5_000,
        caption="C" * 2_000,
        project_text="P" * 5_000,
    )

    assert result.asset_type is ArchitectureAssetType.plan
    request = calls[0]
    assert request["model"] == "gpt-5.4-mini"
    assert request["text_format"] is VisualClassification
    content = request["input"][0]["content"]
    assert content[1] == {"type": "input_image", "image_url": crop, "detail": "high"}
    prompt = content[0]["text"]
    assert len(prompt) < 3_500
    assert "Q" * 1_000 in prompt
    assert "Q" * 1_001 not in prompt
    assert "C" * 500 in prompt
    assert "C" * 501 not in prompt
    assert "P" * 1_200 in prompt
    assert "P" * 1_201 not in prompt
    assert crop not in prompt


def test_openai_visual_classifier_requires_a_structured_result() -> None:
    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            del kwargs
            return SimpleNamespace(output_parsed=None)

    classifier = OpenAIVisualClassifier(
        api_key=None,
        model="gpt-5.4-mini",
        client=SimpleNamespace(responses=FakeResponses()),
    )

    with pytest.raises(ValueError, match="structured visual classification"):
        classifier.classify(
            "data:image/png;base64,ZmFrZQ==",
            question="section",
            caption="",
            project_text="",
        )
