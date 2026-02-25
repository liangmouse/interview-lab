export type CodeTabId = "solution" | "test";

export const MIN_EDITOR_LINES = 14;

export const CODE_TABS: Array<{ id: CodeTabId; label: string }> = [
  { id: "solution", label: "solution.js" },
  { id: "test", label: "test.js" },
];

export const DEFAULT_EDITOR_FILES: Record<CodeTabId, string> = {
  solution: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *   this.val = (val === undefined ? 0 : val);
 *   this.next = (next === undefined ? null : next);
 * }
 */
function reverseList(head) {
  let prev = null;
  let current = head;

  while (current) {
    const next = current.next;
    current.next = prev;
    prev = current;
    current = next;
  }

  return prev;
}
`,
  test: `const input = [1, 2, 3, 4, 5];
const output = [5, 4, 3, 2, 1];

// TODO: implement linked-list helper and assertions
console.log({ input, output });
`,
};

export function getEditorLineNumbers(
  code: string,
  minLines: number = MIN_EDITOR_LINES,
): number[] {
  const lineCount = Math.max(code.split("\n").length, minLines);
  return Array.from({ length: lineCount }, (_, index) => index + 1);
}
