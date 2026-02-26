from __future__ import annotations

from semantic_release.commit_parser.angular import AngularCommitParser
from semantic_release.commit_parser.token import ParsedCommit, ParseError


class PythonScopeParser(AngularCommitParser):
    """Only bumps versions for commits scoped to (python)."""

    def parse(self, commit):
        result = super().parse(commit)
        if isinstance(result, ParsedCommit) and result.scope != "python":
            return ParseError(commit, error=f"Ignored non-python scope: {result.scope}")
        return result
