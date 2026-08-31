export type BooleanSearchNode =
  | { type: "term"; term: string; negated?: true }
  | { type: "and" | "or"; children: BooleanSearchNode[] };

export type BooleanSearchResult =
  | { ok: true; ast: BooleanSearchNode; explicitBoolean: boolean }
  | { ok: false; error: string; position: number };

type Token = {
  type: "term" | "and" | "or" | "not" | "left" | "right";
  value?: string;
  position: number;
};

const MAX_QUERY_LENGTH = 500;
const MAX_TERMS = 32;
const MAX_DEPTH = 8;
const MAX_TERM_LENGTH = 200;

function tokenize(input: string): Token[] | BooleanSearchResult {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    if (/\s/u.test(input[index])) {
      index += 1;
      continue;
    }
    if (input[index] === "(") {
      tokens.push({ type: "left", position: index++ });
      continue;
    }
    if (input[index] === ")") {
      tokens.push({ type: "right", position: index++ });
      continue;
    }
    if (input[index] === '"') {
      const position = index++;
      let value = "";
      let closed = false;
      while (index < input.length) {
        const char = input[index++];
        if (char === '"') {
          closed = true;
          break;
        }
        if (char === "\\" && index < input.length) value += input[index++];
        else value += char;
      }
      if (!closed) return { ok: false, error: "Unclosed quoted phrase", position };
      if (!value.trim()) return { ok: false, error: "Quoted phrases cannot be empty", position };
      tokens.push({ type: "term", value: value.trim(), position });
      continue;
    }
    const position = index;
    while (index < input.length && !/[\s()"]/.test(input[index])) index += 1;
    const value = input.slice(position, index);
    const operator = value.toUpperCase();
    tokens.push({
      type: operator === "AND" ? "and" : operator === "OR" ? "or" : operator === "NOT" ? "not" : "term",
      value: operator === "AND" || operator === "OR" || operator === "NOT" ? undefined : value,
      position,
    });
  }
  return tokens;
}

function combine(type: "and" | "or", left: BooleanSearchNode, right: BooleanSearchNode): BooleanSearchNode {
  const children = [
    ...(left.type === type ? left.children : [left]),
    ...(right.type === type ? right.children : [right]),
  ];
  return { type, children };
}

function negate(node: BooleanSearchNode): BooleanSearchNode {
  if (node.type === "term") {
    return node.negated
      ? { type: "term", term: node.term }
      : { type: "term", term: node.term, negated: true };
  }
  return {
    type: node.type === "and" ? "or" : "and",
    children: node.children.map(negate),
  };
}

export function parseBooleanSearch(input: string): BooleanSearchResult {
  const query = input.trim();
  if (!query) return { ok: false, error: "Enter a search query", position: 0 };
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: `Search cannot exceed ${MAX_QUERY_LENGTH} characters`, position: MAX_QUERY_LENGTH };
  }
  const tokenized = tokenize(query);
  if (!Array.isArray(tokenized)) return tokenized;
  const tokens = tokenized;
  let cursor = 0;
  let terms = 0;
  let explicitBoolean = false;

  const error = (message: string, position = tokens[cursor]?.position ?? query.length): never => {
    throw { message, position };
  };
  const startsOperand = (token?: Token) => Boolean(token && ["term", "not", "left"].includes(token.type));

  function parsePrimary(depth: number): BooleanSearchNode {
    if (depth > MAX_DEPTH) error(`Search nesting cannot exceed ${MAX_DEPTH} levels`);
    const token = tokens[cursor];
    if (!token) error("Expected a search term");
    if (token.type === "term") {
      cursor += 1;
      terms += 1;
      if (terms > MAX_TERMS) error(`Search cannot exceed ${MAX_TERMS} terms`, token.position);
      if (token.value!.length > MAX_TERM_LENGTH) error(`Each search term cannot exceed ${MAX_TERM_LENGTH} characters`, token.position);
      return { type: "term", term: token.value! };
    }
    if (token.type === "left") {
      explicitBoolean = true;
      cursor += 1;
      if (tokens[cursor]?.type === "right") error("Parentheses cannot be empty", token.position);
      const node = parseOr(depth + 1);
      if (tokens[cursor]?.type !== "right") error("Missing closing parenthesis", token.position);
      cursor += 1;
      return node;
    }
    error(token.type === "right" ? "Unexpected closing parenthesis" : "Expected a search term", token.position);
    throw new Error("Unreachable");
  }

  function parseNot(depth: number): BooleanSearchNode {
    if (tokens[cursor]?.type === "not") {
      explicitBoolean = true;
      cursor += 1;
      return negate(parseNot(depth));
    }
    return parsePrimary(depth);
  }

  function parseAnd(depth: number): BooleanSearchNode {
    let node = parseNot(depth);
    while (tokens[cursor]?.type === "and" || startsOperand(tokens[cursor])) {
      if (tokens[cursor]?.type === "and") {
        explicitBoolean = true;
        cursor += 1;
        if (!startsOperand(tokens[cursor])) error("AND must be followed by a search term");
      }
      node = combine("and", node, parseNot(depth));
    }
    return node;
  }

  function parseOr(depth: number): BooleanSearchNode {
    let node = parseAnd(depth);
    while (tokens[cursor]?.type === "or") {
      explicitBoolean = true;
      cursor += 1;
      if (!startsOperand(tokens[cursor])) error("OR must be followed by a search term");
      node = combine("or", node, parseAnd(depth));
    }
    return node;
  }

  try {
    const ast = parseOr(0);
    if (cursor < tokens.length) error("Unexpected token", tokens[cursor].position);
    return { ok: true, ast, explicitBoolean };
  } catch (caught) {
    const value = caught as { message?: string; position?: number };
    return { ok: false, error: value.message || "Invalid Boolean search", position: value.position ?? 0 };
  }
}
