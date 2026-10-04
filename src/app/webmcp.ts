import { z } from "zod";
import { useApp, createWorkflow, type Page } from "./store";
import { templates } from "../lib/templates";
const templateIds = templates.map((t) => t.id);
const templateIdSchema = z.string().refine((id) => templateIds.includes(id));
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function registerStudioTools(
  context: Context | undefined = (
    document as Document & { modelContext?: Context }
  ).modelContext,
) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: "read_workflow_summary",
      title: "بررسی گردش‌کار",
      description:
        "Read the currently visible workflow summary. No execution or mutation.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        z.object({}).strict().parse(input);
        const s = useApp.getState();
        return {
          name: s.workflow?.name,
          nodeCount: s.workflow?.nodes.length,
          runStatus: s.run?.status ?? "none",
          page: s.page,
        };
      },
    },
    {
      name: "navigate_studio",
      title: "رفتن به صفحه",
      description:
        "Navigate the studio UI to editor, library, templates, history or guide.",
      inputSchema: {
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: ["editor", "library", "templates", "history", "guide"],
          },
        },
        required: ["page"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        const { page } = z
          .object({
            page: z.enum([
              "editor",
              "library",
              "templates",
              "history",
              "guide",
            ]),
          })
          .strict()
          .parse(input);
        useApp.getState().setPage(page as Page);
        return { page };
      },
    },
    {
      name: "create_workflow_from_template",
      title: "ساخت از الگو",
      description:
        "Create and locally save a NEW workflow from a bundled template, then open it. Does not run it.",
      inputSchema: {
        type: "object",
        properties: {
          templateId: {
            type: "string",
            enum: templateIds,
          },
        },
        required: ["templateId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input) => {
        const { templateId } = z
          .object({ templateId: templateIdSchema })
          .strict()
          .parse(input);
        const oldId = useApp.getState().workflow?.id;
        await createWorkflow(templates.find((t) => t.id === templateId)!);
        const s = useApp.getState();
        if (s.workflow?.id === oldId || s.saveState !== "saved")
          throw new Error(s.saveError ?? "ساخت گردش‌کار انجام نشد.");
        return { id: s.workflow?.id, name: s.workflow?.name, saved: true };
      },
    },
  ];
  for (const tool of tools)
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Optional proposed API; ordinary UI remains available. */
    }
  return () => lifecycle.abort();
}
