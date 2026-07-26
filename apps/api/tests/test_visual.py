from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from archresearch_api.visual import (
    ArchitectureAssetType,
    MockVisualClassifier,
    OpenAIVisualClassifier,
    RemoteVisualCandidate,
    RemoteVisualClassification,
    RemoteVisualClassificationBatch,
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
    assert request["reasoning"] == {"effort": "medium"}
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


def test_openai_remote_visual_batch_is_bounded_low_detail_and_structured() -> None:
    calls: list[dict[str, Any]] = []

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            return SimpleNamespace(
                output_parsed=RemoteVisualClassificationBatch(
                    classifications=[
                        RemoteVisualClassification(
                            candidate_id="image_1",
                            asset_type=ArchitectureAssetType.section,
                            relevance=4,
                            observations=["可见贯穿多层的剖切空间与楼梯。"],
                        ),
                        RemoteVisualClassification(
                            candidate_id="image_2",
                            asset_type=None,
                            relevance=0,
                            observations=[],
                        ),
                    ]
                )
            )

    classifier = OpenAIVisualClassifier(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    candidates = [
        RemoteVisualCandidate(
            candidate_id=f"image_{index}",
            image_url=f"https://images.example/{index}.jpg",
            caption="A" * 500,
        )
        for index in range(1, 6)
    ]

    result = classifier.classify_remote_batch(
        candidates,
        question="Q" * 2_000,
        project_text="P" * 2_000,
    )

    assert len(result.classifications) == 2
    request = calls[0]
    assert request["model"] == "gpt-5.5"
    assert request["reasoning"] == {"effort": "medium"}
    assert request["text_format"] is RemoteVisualClassificationBatch
    content = request["input"][0]["content"]
    images = [part for part in content if part["type"] == "input_image"]
    assert len(images) == 4
    assert all(image["detail"] == "low" for image in images)
    assert [image["image_url"] for image in images] == [
        f"https://images.example/{index}.jpg" for index in range(1, 5)
    ]
    prompt = content[0]["text"]
    assert "Q" * 1_000 in prompt
    assert "Q" * 1_001 not in prompt
    assert "P" * 1_200 in prompt
    assert "P" * 1_201 not in prompt


def test_openai_remote_visual_batch_retries_two_images_when_relay_rejects_four() -> None:
    calls: list[dict[str, Any]] = []

    class InternalServerError(Exception):
        status_code = 500

    class FakeResponses:
        def parse(self, **kwargs: Any) -> SimpleNamespace:
            calls.append(kwargs)
            if len(calls) == 1:
                raise InternalServerError("relay rejected the four-image request")
            return SimpleNamespace(
                output_parsed=RemoteVisualClassificationBatch(
                    classifications=[
                        RemoteVisualClassification(
                            candidate_id="image_1",
                            asset_type=ArchitectureAssetType.plan,
                            relevance=4,
                            observations=["可见墙体、房间与交通核。"],
                        ),
                        RemoteVisualClassification(
                            candidate_id="image_2",
                            asset_type=ArchitectureAssetType.section,
                            relevance=4,
                            observations=["可见楼板高差与竖向联系。"],
                        ),
                    ]
                )
            )

    classifier = OpenAIVisualClassifier(
        api_key=None,
        model="gpt-5.5",
        client=SimpleNamespace(responses=FakeResponses()),
    )
    candidates = [
        RemoteVisualCandidate(
            candidate_id=f"image_{index}",
            image_url=f"https://images.example/{index}.jpg",
        )
        for index in range(1, 5)
    ]

    result = classifier.classify_remote_batch(
        candidates,
        question="比较平面与剖面的空间关系。",
        project_text="",
    )

    assert len(result.classifications) == 2
    assert len(calls) == 2
    retried_images = [
        part for part in calls[1]["input"][0]["content"] if part["type"] == "input_image"
    ]
    assert [image["image_url"] for image in retried_images] == [
        "https://images.example/1.jpg",
        "https://images.example/2.jpg",
    ]
