/** @type {import("prettier").Config} */
const config = {
  semi: false,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: "es5",
  tabWidth: 2,
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
}

export default config
