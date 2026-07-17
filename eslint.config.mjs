import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "dist-electron/**", "generated/**", "node_modules/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs", "*.config.{js,mjs,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-require-imports": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name="FC"] > ArrowFunctionExpression > ObjectPattern.params',
          message:
            "Do not destructure component props in the parameter list. Receive props as a named parameter and destructure inside the component body."
        },
        {
          selector: 'JSXExpressionContainer > ConditionalExpression[alternate.type="Literal"][alternate.value=null]',
          message: "Use && for conditional JSX rendering instead of a ternary with : null."
        }
      ],
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off"
    }
  }
);
