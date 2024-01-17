import fs from "node:fs";
import * as acorn from "acorn";

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
        ast.style = { code };
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
        const value = content.slice(currentIndex, lastIndex);
        if (value.startsWith(`"`) || value.startsWith(`'`)) {
          value = value.slice(1, -1);
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
        let expression = acorn.parse(content.slice(startIndex, endIndex), {
          ecmaVersion: 2022,
        });
        i = endIndex;
        advance_index("}");
        return { type: "expression", expression };
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
}

const parser = new SVELTEParser();
const code = parser.parse();
fs.writeFileSync("./ast.json", JSON.stringify(code, null, 2), "utf8");
