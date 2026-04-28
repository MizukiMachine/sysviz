from __future__ import annotations

from textwrap import dedent


def build_generation_prompt(diagram_kind: str, repository: str, context_json: str) -> str:
    return dedent(
        f"""
        You generate Mermaid diagrams for SysViz.
        Return only Mermaid source code.

        Repository: {repository}
        Diagram kind: {diagram_kind}

        Requirements:
        - Prefer concise labels.
        - Use valid Mermaid syntax.
        - Keep diagrams readable for 3D visualization.
        - Do not wrap output in markdown fences.

        Input context JSON:
        {context_json}
        """
    ).strip()
