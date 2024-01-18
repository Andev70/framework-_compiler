import fs from "node:fs";
import * as acorn from "acorn";
import * as estreewalker from "estree-walker";
import * as escodegen from "escodegen";
import * as periscopic from "periscopic";
const content = fs.readFileSync("./app.svelte", "utf8");

let i = 0;
class SVELTEParser {
  svelteCode;
  constructor(codeString) {
    this.svelteCode = codeString;
  }
  // parsing svelte start
  parse() {
    const ast = {};

    // parseing fragments

    function parseFragments(condition) {
      const fragments = [];
      while (condition()) {
        const fragment = parseFragment();
        if (fragment) {
          fragments.push(fragment);
        }
      }
      return fragments;
    }

    //parse fragment only

    function parseFragment() {
      return (
        parseScript() ??
        parseElement() ??
        parseExpression() ??
        parseTextContent() ??
        parseStyle()
      );
    }

    // parse element

    function parseElement() {
      if (matchString("<")) {
        advance_index("<");
        const tagName = readWhileMatching(/[a-z]/);

        const attributes = parseAttributeList();
        advance_index(">");
        const endTag = `</${tagName}>`;

        const element = {
          type: "Element",
          name: tagName,
          attributes,
          children: parseFragments(() => {
            if (!matchString(endTag) && !isSelfClosingTag(tagName)) {
              return true;
            }
          }),
        };
        if (!isSelfClosingTag(tagName)) {
          advance_index(endTag);
        }
        return element;
      }
    }

    // parse script

    function parseScript() {
      if (matchString("<script>")) {
        advance_index("<script>");
        const currentIndex = i;
        const endIndex = content.indexOf("</script>", i);
        const javascriptCode = content.slice(currentIndex, endIndex);
        ast.script = acorn.parse(javascriptCode, { ecmaVersion: 2022 });
        i = endIndex;
        advance_index("</script>");
      }
    }

    // parse style

    function parseStyle() {
      if (matchString("<style>")) {
        advance_index("<style>");
        const startIndex = i;
        const endIndex = content.indexOf("</style>", i);
        const code = content.slice(startIndex, endIndex);
        i = endIndex;
        advance_index("</style>");

        fs.writeFileSync("./style.css", code, "utf-8");
      }
    }

    // parse attribute list

    function parseAttributeList() {
      const attributes = [];
      skipWhitespace();
      while (!matchString(">")) {
        attributes.push(parseQuotedAttribute());
        attributes.push(parseExpressionAttribute());
        skipWhitespace();
      }
      return attributes;
    }

    // parse quoted attributes

    function parseQuotedAttribute() {
      const name = readWhileMatching(/[^=\s\n>]/);

      if (matchString('="')) {
        advance_index(`="`);
        const startIndex = i;
        const endIndex = content.indexOf(`"`, i);
        const attText = content.slice(startIndex, endIndex);
        i = endIndex;
        advance_index(`"`);

        return {
          type: "Attribute",
          name,
          value: attText,
        };
      }
    }
    //parse javascript expression attributes

    function parseExpressionAttribute() {
      if (matchString("=")) {
        const name = content.substring(0, i).split(/\s+/).pop();
        advance_index("={");
        //const value = readWhileMatching(/[^}\s\n>]/); // Read the attribute value
        const currentIndex = i;
        const lastIndex = content.indexOf("}", i);
        let value = content.slice(currentIndex, lastIndex);
        if (
          value.startsWith(`{"`) ||
          value.startsWith(`{'`) ||
          value.startsWith(`"`) ||
          value.startsWith(`'`)
        ) {
          value = value.slice(1, -1);
        } else {
          value = acorn.parse(value, { ecmaVersion: 2022 });
        }
        i = lastIndex;
        advance_index("}");
        return {
          type: "Attribute",
          name,
          value,
        };
      }
    }

    // parse expression

    function parseExpression() {
      if (matchString("{")) {
        advance_index("{");
        const startIndex = i;
        const endIndex = content.indexOf("}", i);
        const name = content.slice(startIndex, endIndex);
        let expression = acorn.parse(name, {
          ecmaVersion: 2022,
        });
        i = endIndex;
        advance_index("}");
        return { type: "Expression", expression, name };
      }
    }
    // parse text content

    function parseTextContent() {
      const text = readWhileMatching(/[^<{]/);
      if (text.trim() !== "") {
        return {
          type: "Text",
          value: text,
        };
      }
    }

    /*helpers for my compiler*/

    // match something or a string

    function matchString(str) {
      return content.slice(i, i + str.length) === str;
    }

    // advance i if done
    function advance_index(str) {
      if (matchString(str)) {
        i += str.length;
      } else {
        throw new Error(`Parse error: expecting ${str}`);
      }
    }

    // read while matching
    function readWhileMatching(regex) {
      let startIndex = i;
      while (i < content.length && regex.test(content[i])) {
        i++;
      }
      return content.slice(startIndex, i);
    }

    // skip and advance i if ancountered whitespaces
    function skipWhitespace() {
      readWhileMatching(/[\s\n]/);
    }
    // check if self closing tag or not

    function isSelfClosingTag(tagname) {
      const selfClosingTags = [
        "area",
        "base",
        "br",
        "col",
        "command",
        "embed",
        "hr",
        "img",
        "input",
        "keygen",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
      ];
      if (selfClosingTags.includes(tagname)) {
        return true;
      }
    }
    //end of selfclosing check

    ast.html = parseFragments(() => i < content.length);

    return ast;
  }
  /* end of parse svelte method*/
  // analyse the abstract syntax tree
  analyse(ast) {
    const result = {
      variables: new Set(),
      willChange: new Set(),
      willUseInTemplate: new Set(),
    };

    const { scope: rootScope, map } = periscopic.analyze(ast.script);
    result.variables = new Set(rootScope.declarations.keys());
    result.rootScope = rootScope;
    result.map = map;

    let currentScope = rootScope;
    estreewalker.walk(ast.script, {
      enter(node) {
        if (node.type === "BlockStatement") {
          console.log(node.body[0].expression.left.name);
        }
        if (map.has(node)) currentScope = map.get(node);
        if (
          node.type === "UpdateExpression" &&
          currentScope.find_owner(node.argument.name) === rootScope
        ) {
          result.willChange.add(node.argument.name);
        } else if (
          node.type === "BlockStatement" &&
          currentScope.find_owner(node.body[0].expression.left.name)
        ) {
          result.willChange.add(node.body[0].expression.left.name);
        }
      },
      leave(node) {
        if (map.has(node)) currentScope = currentScope.parent;
      },
    });

    function traverse(fragment) {
      switch (fragment?.type) {
        case "Element":
          fragment.children.forEach((child) => traverse(child));
          fragment.attributes.forEach((attribute) => traverse(attribute));
          break;
        case "Attribute":
          // No neebd to add every attribute, only those with expressions in curly brackets
          if (fragment.value && fragment.value.type === "Expression") {
            result.willUseInTemplate.add(fragment.value.expression.name);
          }
          break;
        case "Expression":
          result.willUseInTemplate.add(fragment.name);
          break;
      }
    }
    ast.html.forEach((fragment) => traverse(fragment));

    return result;
  }

  // generate optimysed javascript code
  generate(ast, analysis) {
    const code = {
      variables: [],
      create: [],
      update: [],
      destroy: [],
    };

    let counter = 1;
    function traverse(node, parent) {
      switch (node?.type) {
        case "Element": {
          const variableName = `${node.name}_${counter++}`;
          code.variables.push(variableName);
          code.create.push(
            `${variableName} = document.createElement('${node.name}');`
          );
          node.attributes.forEach((attribute) => {
            traverse(attribute, variableName);
          });
          node.children.forEach((child) => {
            traverse(child, variableName);
          });
          code.create.push(`${parent}.appendChild(${variableName})`);
          code.destroy.push(`${parent}.removeChild(${variableName})`);
          break;
        }
        case "Text": {
          const variableName = `txt_${counter++}`;
          code.variables.push(variableName);
          code.create.push(
            `${variableName} = document.createTextNode('${node.value}')`
          );
          code.create.push(`${parent}.appendChild(${variableName})`);
          break;
        }
        case "Attribute": {
          if (node.name.startsWith("on:")) {
            const eventName = node.name.slice(3);
            const eventHandler = node.value.body[0].expression.name;

            code.create.push(
              `${parent}.addEventListener('${eventName}', ${eventHandler});`
            );
            code.destroy.push(
              `${parent}.removeEventListener('${eventName}', ${eventHandler});`
            );
          }
          break;
        }
        case "Expression": {
          const variableName = `txt_${counter++}`;
          const expression = node.name;

          code.variables.push(variableName);
          code.create.push(
            `${variableName} = document.createTextNode(${expression})`
          );
          code.create.push(`${parent}.appendChild(${variableName});`);
          if (analysis.willChange.has(node.name)) {
            code.update.push(`if (changed.includes('${expression}')) {
            ${variableName}.data = ${expression};
          }`);
          }
          break;
        }
      }
    }

    ast.html.forEach((fragment) => traverse(fragment, "target"));

    const { rootScope, map } = analysis;
    let currentScope = rootScope;
    estreewalker.walk(ast.script, {
      enter(node) {
        if (map.has(node)) currentScope = map.get(node);
        if (
          node?.type === "UpdateExpression" &&
          currentScope.find_owner(node.argument.name) === rootScope &&
          analysis.willUseInTemplate.has(node.argument.name)
        ) {
          this.replace({
            type: "SequenceExpression",
            expressions: [
              node,
              acorn.parseExpressionAt(
                `lifecycle.update(['${node.argument.name}'])`,
                0,
                {
                  ecmaVersion: 2022,
                }
              ),
            ],
          });
          this.skip();
        } else if (
          node?.type === "BlockStatement" &&
          currentScope.find_owner(node.body[0].expression.left.name) ===
            rootScope &&
          analysis.willUseInTemplate.has(node.body[0].expression.left.name)
        ) {
          this.replace({
            type: "SequenceExpression",
            expressions: [
              node,
              acorn.parseExpressionAt(
                `lifecycle.update(['${node.body[0].expression.left.name}'])`,
                0,
                {
                  ecmaVersion: 2022,
                }
              ),
            ],
          });
          this.skip();
        }
      },
      leave(node) {
        if (map.has(node)) currentScope = currentScope.parent;
      },
    });
    return `
    export default function() {
      ${code.variables.map((v) => `let ${v};`).join("\n")}
      ${escodegen.generate(ast.script)}
      const lifecycle = {
        create(target) {
          ${code.create.join("\n")}
        },
        update(changed) {
          ${code.update.join("\n")}
        },
        destroy() {
          ${code.destroy.join("\n")}
        },
      };
      return lifecycle;
    }
  `;
  }
}

const parser = new SVELTEParser();
const ast = parser.parse();
fs.writeFileSync("./ast.json", JSON.stringify(ast, null, 2), "utf8");
const analysis = parser.analyse(ast);
const js = parser.generate(ast, analysis);
fs.writeFileSync("./app.js", js, "utf8");
