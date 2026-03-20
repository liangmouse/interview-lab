export type CodeTabId = "solution" | "test";

export interface CodeProblem {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  language: "javascript" | "typescript" | "python";
  solutionTemplate: string;
  testTemplate: string;
}

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
  test: `// --- Linked-list helpers ---
function ListNode(val, next) {
  this.val = (val === undefined ? 0 : val);
  this.next = (next === undefined ? null : next);
}

function arrayToList(arr) {
  if (!arr.length) return null;
  let head = new ListNode(arr[0]);
  let cur = head;
  for (let i = 1; i < arr.length; i++) {
    cur.next = new ListNode(arr[i]);
    cur = cur.next;
  }
  return head;
}

function listToArray(head) {
  const result = [];
  while (head) { result.push(head.val); head = head.next; }
  return result;
}

function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

// --- Test cases ---
assertEqual(listToArray(reverseList(arrayToList([1, 2, 3, 4, 5]))), [5, 4, 3, 2, 1], "basic case");
assertEqual(listToArray(reverseList(arrayToList([1, 2]))),          [2, 1],           "two nodes");
assertEqual(listToArray(reverseList(arrayToList([1]))),             [1],              "single node");
assertEqual(listToArray(reverseList(null)),                         [],               "empty list");
`,
};

export function buildEditorFiles(
  problem?: CodeProblem,
): Record<CodeTabId, string> {
  if (!problem) return DEFAULT_EDITOR_FILES;
  return {
    solution: problem.solutionTemplate,
    test: problem.testTemplate,
  };
}

export function getEditorLineNumbers(
  code: string,
  minLines: number = MIN_EDITOR_LINES,
): number[] {
  const lineCount = Math.max(code.split("\n").length, minLines);
  return Array.from({ length: lineCount }, (_, index) => index + 1);
}
