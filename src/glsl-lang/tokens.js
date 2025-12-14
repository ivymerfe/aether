
import { ExternalTokenizer } from "@lezer/lr";
import { PreprocArg } from "./parser.terms.js";

const slash = 47,
  newline = 10;

export const preprocArg = new ExternalTokenizer(
  (input) => {
    while (
      input.next !== slash &&
      input.peek(1) !== slash &&
      input.next !== -1 &&
      input.next !== slash &&
      input.next !== newline
    ) {
      input.advance();
    }
    input.acceptToken(PreprocArg);
  },
  { contextual: true }
);
