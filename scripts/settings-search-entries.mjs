import ts from "typescript";

export function settingsSearchEntries(source) {
  const file = ts.createSourceFile("nav.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let entries;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "SETTINGS_OPTIONS") {
      if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer)) {
        throw new Error("SETTINGS_OPTIONS must be an array literal");
      }
      entries = node.initializer.elements.map((element) => {
        if (!ts.isObjectLiteralExpression(element)) throw new Error("Unexpected settings search entry");
        const fields = new Map(element.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(file), p.initializer]));
        const string = (key) => {
          const value = fields.get(key);
          if (!value) return undefined;
          if (!ts.isStringLiteral(value)) throw new Error(`Expected a string for ${key}`);
          return value.text;
        };
        const keywordNodes = fields.get("keywords");
        if (keywordNodes && !ts.isArrayLiteralExpression(keywordNodes)) throw new Error("Expected a keyword array");
        const keywords = keywordNodes ? keywordNodes.elements.map((value) => {
          if (!ts.isStringLiteral(value)) throw new Error("Expected a string keyword");
          return value.text;
        }) : [];
        const label = string("label");
        const section = string("section");
        if (!label || !section) throw new Error("Settings search entry needs a label and section");
        return { label, section, anchor: string("anchorTitle"), keywords };
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!entries?.length) throw new Error("No settings search entries were indexed");
  return entries;
}
