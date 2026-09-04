export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["shared", "dice", "content", "api", "web", "docs", "repo", "deps"],
    ],
  },
};
