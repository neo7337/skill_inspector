"""Unit tests for Skill Package resolution and token economy accounting."""
from pathlib import Path
import pytest

from app.parser import FileReference, parse_skill_md
from app.package import (
    ReferenceFileStatus,
    ResolvedFileReference,
    PackageTokenEconomy,
    SkillPackage,
    is_binary_file,
    resolve_file_reference,
    compute_package_token_economy,
    resolve_skill_package,
    PEAK_TOKEN_CAUTION_THRESHOLD,
    PEAK_TOKEN_WARN_THRESHOLD,
)


@pytest.fixture
def temp_skill_dir(tmp_path: Path) -> Path:
    """Creates a temporary realistic skill directory structure."""
    skill_dir = tmp_path / "sample-skill"
    skill_dir.mkdir()

    # Create subdirectories
    (skill_dir / "scripts").mkdir()
    (skill_dir / "references").mkdir()
    (skill_dir / "assets").mkdir()

    # Create files
    (skill_dir / "scripts" / "extract.py").write_text(
        "import sys\nprint('extracted text')\n", encoding="utf-8"
    )
    (skill_dir / "references" / "guide.md").write_text(
        "# Extended Guide\n\nDetailed instructions for operations.\n", encoding="utf-8"
    )
    (skill_dir / "assets" / "diagram.png").write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

    # Create root SKILL.md
    skill_md_content = """---
name: sample-skill
description: A sample test skill for testing package resolution.
---

## Instructions

Run `scripts/extract.py` to extract text.
Consult [references/guide.md](references/guide.md) for details.
View `assets/diagram.png` for flow.
Also see `references/nonexistent.md` for extra help.
"""
    (skill_dir / "SKILL.md").write_text(skill_md_content, encoding="utf-8")
    return skill_dir


class TestIsBinaryFile:
    def test_text_files(self, tmp_path: Path):
        f = tmp_path / "test.py"
        f.write_text("print('hello')", encoding="utf-8")
        assert is_binary_file(f) is False

        f2 = tmp_path / "doc.md"
        f2.write_text("# Markdown", encoding="utf-8")
        assert is_binary_file(f2) is False

    def test_binary_extension(self, tmp_path: Path):
        f = tmp_path / "image.png"
        f.write_bytes(b"\x89PNG")
        assert is_binary_file(f) is True

    def test_binary_content_with_null_bytes(self, tmp_path: Path):
        f = tmp_path / "custom.dat"
        f.write_bytes(b"some text with \x00 null byte")
        assert is_binary_file(f) is True


class TestResolveFileReference:
    def test_found_text_reference(self, temp_skill_dir: Path):
        ref = FileReference(path="scripts/extract.py", kind="script")
        resolved = resolve_file_reference(ref, temp_skill_dir)

        assert resolved.status == ReferenceFileStatus.FOUND
        assert resolved.relative_path == "scripts/extract.py"
        assert resolved.kind == "script"
        assert resolved.is_binary is False
        assert resolved.line_count == 2
        assert resolved.token_count > 0
        assert resolved.content_preview is not None
        assert "print('extracted text')" in resolved.content_preview

    def test_found_binary_reference(self, temp_skill_dir: Path):
        ref = FileReference(path="assets/diagram.png", kind="asset")
        resolved = resolve_file_reference(ref, temp_skill_dir)

        assert resolved.status == ReferenceFileStatus.FOUND
        assert resolved.is_binary is True
        assert resolved.token_count == 0
        assert resolved.content_preview is None

    def test_missing_reference(self, temp_skill_dir: Path):
        ref = FileReference(path="references/nonexistent.md", kind="reference")
        resolved = resolve_file_reference(ref, temp_skill_dir)

        assert resolved.status == ReferenceFileStatus.MISSING
        assert resolved.token_count == 0
        assert resolved.content_preview is None

    def test_path_traversal_prevention(self, temp_skill_dir: Path):
        # Attempt to escape base directory via ..
        ref = FileReference(path="../../etc/passwd", kind="other")
        resolved = resolve_file_reference(ref, temp_skill_dir)

        assert resolved.status == ReferenceFileStatus.OUTSIDE_ROOT
        assert resolved.absolute_path is None

    def test_unreadable_directory_as_file(self, temp_skill_dir: Path):
        # Pointing to scripts/ which is a directory, not a file
        ref = FileReference(path="scripts", kind="script")
        resolved = resolve_file_reference(ref, temp_skill_dir)

        assert resolved.status == ReferenceFileStatus.UNREADABLE


class TestComputePackageTokenEconomy:
    def test_token_economy_calculation(self):
        doc = parse_skill_md("""---
name: test-skill
description: "12345678901234567890"
---
Instruction body of text that is roughly forty characters long.
""")
        # Name (10) + Desc (20) = 30 chars => 7 catalog tokens
        # Body (63 chars) => 15 activation tokens
        resolved_files = [
            ResolvedFileReference(
                relative_path="references/guide.md",
                kind="reference",
                status=ReferenceFileStatus.FOUND,
                token_count=100,
            ),
            ResolvedFileReference(
                relative_path="scripts/test.py",
                kind="script",
                status=ReferenceFileStatus.FOUND,
                token_count=50,
            ),
            ResolvedFileReference(
                relative_path="references/missing.md",
                kind="reference",
                status=ReferenceFileStatus.MISSING,
                token_count=0,
            ),
        ]

        tokens = compute_package_token_economy(doc, resolved_files)

        assert tokens.catalog_tokens == 7
        assert tokens.activation_tokens == 15
        assert tokens.on_demand_tokens_by_file == {
            "references/guide.md": 100,
            "scripts/test.py": 50,
        }
        assert tokens.total_on_demand_tokens == 150
        assert tokens.peak_context_footprint == 15 + 150
        assert tokens.budget_status == "within_budget"

    def test_budget_status_thresholds(self):
        doc = parse_skill_md("""---
name: s
description: d
---
Short body.
""")
        # Caution threshold (> 8000)
        caution_files = [
            ResolvedFileReference(
                relative_path="ref.md",
                kind="reference",
                status=ReferenceFileStatus.FOUND,
                token_count=PEAK_TOKEN_CAUTION_THRESHOLD + 10,
            )
        ]
        tokens_caution = compute_package_token_economy(doc, caution_files)
        assert tokens_caution.budget_status == "caution"

        # Exceeded threshold (> 15000)
        exceeded_files = [
            ResolvedFileReference(
                relative_path="ref.md",
                kind="reference",
                status=ReferenceFileStatus.FOUND,
                token_count=PEAK_TOKEN_WARN_THRESHOLD + 10,
            )
        ]
        tokens_exceeded = compute_package_token_economy(doc, exceeded_files)
        assert tokens_exceeded.budget_status == "exceeded"


class TestResolveSkillPackage:
    def test_auto_discover_package(self, temp_skill_dir: Path):
        package = resolve_skill_package(temp_skill_dir)

        assert isinstance(package, SkillPackage)
        assert package.base_dir == str(temp_skill_dir.resolve())
        assert package.skill_doc.name == "sample-skill"
        assert len(package.resolved_files) == 4
        assert package.found_files_count == 3  # extract.py, guide.md, diagram.png
        assert package.missing_files_count == 1  # nonexistent.md
        assert package.tokens.total_on_demand_tokens > 0
        assert package.tokens.peak_context_footprint > 0

    def test_explicit_content_override(self, temp_skill_dir: Path):
        override_content = """---
name: overridden-skill
description: Custom override.
---
Only references `scripts/extract.py`.
"""
        package = resolve_skill_package(temp_skill_dir, skill_content=override_content)

        assert package.skill_doc.name == "overridden-skill"
        assert len(package.resolved_files) == 1
        assert package.resolved_files[0].relative_path == "scripts/extract.py"
        assert package.found_files_count == 1
        assert package.missing_files_count == 0

    def test_case_insensitive_skill_md(self, tmp_path: Path):
        folder = tmp_path / "skill-lower"
        folder.mkdir()
        (folder / "skill.md").write_text("---\nname: lower\ndescription: test\n---\nBody\n")
        package = resolve_skill_package(folder)
        assert package.skill_doc.name == "lower"

    def test_doc_resolve_package_method(self, temp_skill_dir: Path):
        doc = parse_skill_md((temp_skill_dir / "SKILL.md").read_text(encoding="utf-8"))
        package = doc.resolve_package(temp_skill_dir)
        assert isinstance(package, SkillPackage)
        assert package.skill_doc.name == "sample-skill"
        assert package.found_files_count == 3

    def test_missing_directory_raises(self, tmp_path: Path):
        nonexistent = tmp_path / "does-not-exist"
        with pytest.raises(FileNotFoundError, match="Base directory does not exist"):
            resolve_skill_package(nonexistent)

    def test_file_as_base_dir_raises(self, temp_skill_dir: Path):
        file_path = temp_skill_dir / "SKILL.md"
        with pytest.raises(NotADirectoryError, match="not a directory"):
            resolve_skill_package(file_path)

    def test_directory_without_skill_md_raises(self, tmp_path: Path):
        empty_dir = tmp_path / "empty-skill"
        empty_dir.mkdir()
        with pytest.raises(FileNotFoundError, match="No SKILL.md or skill.md found"):
            resolve_skill_package(empty_dir)
