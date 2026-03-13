// Allows importing plain CSS files in TypeScript files
// Used for side-effect imports like `import "./styles.css"`.

declare module "*.css" {
    const content: Record<string, string>;
    export default content;
}
