#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from generators.mmd_generator import choose_diagram_specs, generate_mmd


def run_command(command: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise RuntimeError(
            f"command failed: {' '.join(command)}\nstdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )
    return proc


def run_json_command(command: list[str], cwd: Path) -> Any:
    proc = run_command(command, cwd=cwd)
    output = proc.stdout.strip()
    if not output:
        return []

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return {
            "command": command,
            "raw": output,
            "error": "non_json_output",
        }


def normalize_context(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "clusters": payload.get("clusters") or [],
        "processes": payload.get("processes") or [],
        "context": payload.get("context") or [],
        "impact": payload.get("impact") or [],
    }


def infer_symbol_count(context: dict[str, Any]) -> int:
    return max(
        len(context.get("clusters") or []),
        len(context.get("processes") or []),
        len(context.get("context") or []),
        len(context.get("impact") or []),
    ) * 100


def infer_project_size(symbol_count: int) -> str:
    if symbol_count < 500:
        return "Small"
    if symbol_count < 2000:
        return "Medium"
    return "Large"


def infer_project_type(context: dict[str, Any]) -> str:
    process_blob = json.dumps(context.get("processes") or [], ensure_ascii=False).lower()
    if "http" in process_blob or "route" in process_blob or "controller" in process_blob:
        return "Backend API"
    return "Software System"


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sanitize_storage_segment(value: str) -> str:
    trimmed = value.strip().strip("/")
    if not trimmed:
        return "unknown"

    sanitized = trimmed.replace("/", "__")
    sanitized = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in sanitized)
    sanitized = sanitized.strip("_")
    return sanitized or "unknown"


def resolve_output_dir(output_root: Path, target_project_path: str, target_ref: str) -> Path:
    return output_root / sanitize_storage_segment(target_project_path) / sanitize_storage_segment(target_ref)


def build_clone_url(gitlab_url: str, target_project_path: str, target_repository_url: str | None) -> str:
    if target_repository_url:
        return target_repository_url
    if not gitlab_url or not target_project_path:
        raise ValueError("target repository URL could not be resolved")
    return f"{gitlab_url.rstrip('/')}/{target_project_path}.git"


def inject_clone_credentials(url: str, token: str | None, username: str) -> str:
    if not token:
        return url

    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return url

    netloc = f"{username}:{token}@{parsed.netloc}"
    return urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment))


def clone_repository(repo_url: str, target_ref: str, clone_token: str | None, clone_username: str) -> tuple[Path, str]:
    temp_dir = Path(tempfile.mkdtemp(prefix="sysviz-target-"))
    repo_dir = temp_dir / "repo"
    authenticated_url = inject_clone_credentials(repo_url, clone_token, clone_username)

    run_command(["git", "clone", "--depth", "1", "--branch", target_ref, authenticated_url, str(repo_dir)])
    commit_sha = run_command(["git", "rev-parse", "HEAD"], cwd=repo_dir).stdout.strip()
    return repo_dir, commit_sha


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-root", default=os.getenv("SYSVIZ_OUTPUT_ROOT", "outputs"))
    parser.add_argument("--target-project-path", default=os.getenv("TARGET_PROJECT_PATH"), required=False)
    parser.add_argument("--target-ref", default=os.getenv("TARGET_REF", "main"))
    parser.add_argument("--target-repository-url", default=os.getenv("TARGET_REPOSITORY_URL"))
    parser.add_argument("--gitlab-url", default=os.getenv("SYSVIZ_GITLAB_URL") or os.getenv("CI_SERVER_URL"))
    parser.add_argument("--clone-token", default=os.getenv("SYSVIZ_GITLAB_TOKEN") or os.getenv("CI_JOB_TOKEN"))
    parser.add_argument("--clone-username", default=os.getenv("SYSVIZ_GITLAB_CLONE_USERNAME", "oauth2"))
    parser.add_argument("--llm-provider", default=os.getenv("SYSVIZ_LLM_PROVIDER"))
    parser.add_argument("--llm-model", default=os.getenv("SYSVIZ_LLM_MODEL"))
    parser.add_argument("--llm-api-key", default=os.getenv("SYSVIZ_LLM_API_KEY"))
    parser.add_argument("--repository", default=None)
    args = parser.parse_args()
    if not args.target_project_path:
        parser.error("--target-project-path or TARGET_PROJECT_PATH is required")
    return args


def main() -> int:
    args = parse_args()

    repo_url = build_clone_url(args.gitlab_url or "", args.target_project_path, args.target_repository_url)
    output_root = Path(args.output_root)
    output_dir = resolve_output_dir(output_root, args.target_project_path, args.target_ref)
    ensure_output_dir(output_dir)

    repo_dir: Path | None = None
    clone_root: Path | None = None
    target_commit_sha = ""

    try:
        repo_dir, target_commit_sha = clone_repository(
            repo_url,
            args.target_ref,
            args.clone_token,
            args.clone_username,
        )
        clone_root = repo_dir.parent

        run_command(["npx", "gitnexus", "analyze", "--embeddings"], cwd=repo_dir)
        raw_payload = {
            "clusters": run_json_command(["npx", "gitnexus", "clusters", "--json"], cwd=repo_dir),
            "processes": run_json_command(["npx", "gitnexus", "processes", "--json"], cwd=repo_dir),
            "context": run_json_command(["npx", "gitnexus", "context", "--json"], cwd=repo_dir),
            "impact": run_json_command(["npx", "gitnexus", "impact", "--json"], cwd=repo_dir),
        }
        context = normalize_context(raw_payload)
        write_json(output_dir / "context.json", raw_payload)

        symbol_count = infer_symbol_count(context)
        specs = choose_diagram_specs(symbol_count)
        diagrams: list[dict[str, str]] = []
        repository = args.repository or args.target_project_path

        for spec in specs:
            mermaid = generate_mmd(
                spec=spec,
                repository=repository,
                context=context,
                llm_provider=args.llm_provider,
                llm_model=args.llm_model,
                llm_api_key=args.llm_api_key,
            )
            (output_dir / spec.file).write_text(mermaid.strip() + "\n", encoding="utf-8")
            diagrams.append({
                "file": spec.file,
                "label": spec.label,
                "type": spec.kind,
            })

        manifest = {
            "repository": repository,
            "target_project_path": args.target_project_path,
            "target_ref": args.target_ref,
            "target_commit_sha": target_commit_sha,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "pipeline_id": int(os.getenv("CI_PIPELINE_ID", "0") or 0),
            "project_type": infer_project_type(context),
            "project_size": infer_project_size(symbol_count),
            "diagrams": diagrams,
        }
        write_json(output_dir / "manifest.json", manifest)
        return 0
    finally:
        if clone_root and clone_root.exists():
            shutil.rmtree(clone_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
