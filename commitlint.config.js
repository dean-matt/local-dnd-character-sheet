export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", ["shared", "content", "api", "web", "docs", "repo", "deps"]],
  },
};
