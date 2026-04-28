from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import requests

from .prompt_templates import build_generation_prompt


@dataclass(frozen=True)
class DiagramSpec:
    file: str
    label: str
    kind: str


DEFAULT_SPECS = [
    DiagramSpec("01_layered_architecture.mmd", "Layered Architecture", "flowchart"),
    DiagramSpec("02_component.mmd", "Component", "flowchart"),
    DiagramSpec("03_dependency.mmd", "Dependency", "flowchart"),
    DiagramSpec("04_sequence_request_lifecycle.mmd", "Request Lifecycle", "sequence"),
]


def choose_diagram_specs(symbol_count: int) -> list[DiagramSpec]:
    if symbol_count < 500:
        return DEFAULT_SPECS[:3]
    return DEFAULT_SPECS


def _fallback_flowchart(title: str, clusters: list[dict[str, Any]]) -> str:
    lines = ["flowchart LR", f'  root["{title}"]']
    for index, cluster in enumerate(clusters[:6], start=1):
        cluster_id = f"c{index}"
        label = str(cluster.get("label") or cluster.get("name") or f"Cluster {index}").replace('"', "'")
        lines.append(f'  {cluster_id}["{label}"]')
        lines.append(f"  root --> {cluster_id}")
    if len(lines) == 2:
        lines.append('  empty["No cluster data"]')
        lines.append("  root --> empty")
    return "\n".join(lines)


def _fallback_sequence(processes: list[dict[str, Any]]) -> str:
    lines = ["sequenceDiagram"]
    participants: list[str] = []
    for item in processes[:8]:
        actor = str(item.get("source") or item.get("from") or "Caller")
        target = str(item.get("target") or item.get("to") or "Worker")
        if actor not in participants:
            participants.append(actor)
            lines.append(f"  participant {actor}")
        if target not in participants:
            participants.append(target)
            lines.append(f"  participant {target}")
        label = str(item.get("label") or item.get("action") or "call").replace('"', "'")
        lines.append(f"  {actor}->>{target}: {label}")
    if len(lines) == 1:
        lines.extend([
            "  participant Caller",
            "  participant Worker",
            "  Caller->>Worker: No process data",
        ])
    return "\n".join(lines)


def _call_gemini(api_key: str, model: str, prompt: str) -> str:
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": api_key},
        timeout=60,
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2},
        },
    )
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError("Gemini returned no candidates")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise RuntimeError("Gemini returned empty text")
    return text


def _call_glm(api_key: str, model: str, prompt: str) -> str:
    response = requests.post(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        timeout=60,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        },
    )
    response.raise_for_status()
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("GLM returned no choices")
    text = choices[0].get("message", {}).get("content", "").strip()
    if not text:
        raise RuntimeError("GLM returned empty text")
    return text


def generate_mmd(
    *,
    spec: DiagramSpec,
    repository: str,
    context: dict[str, Any],
    llm_provider: str | None,
    llm_model: str | None,
    llm_api_key: str | None,
) -> str:
    if llm_provider and llm_model and llm_api_key:
        prompt = build_generation_prompt(spec.kind, repository, json.dumps(context, ensure_ascii=False, indent=2))
        if llm_provider == "gemini":
            return _call_gemini(llm_api_key, llm_model, prompt)
        if llm_provider == "glm":
            return _call_glm(llm_api_key, llm_model, prompt)
        raise ValueError(f"Unsupported provider: {llm_provider}")

    clusters = context.get("clusters") or []
    processes = context.get("processes") or []
    if spec.kind == "sequence":
        return _fallback_sequence(processes)
    return _fallback_flowchart(spec.label, clusters)
