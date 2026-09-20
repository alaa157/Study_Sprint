import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupCard } from "./components/GroupCard";
import { PromiseControls } from "./components/PromiseControls";
import { HEADINGS, PRIMARY_ACTIONS, PRODUCT_PROMISE } from "./lib/copy";

/** react-dom escapes apostrophes in text nodes: "I'm done" renders as "I&#x27;m done". */
const asRendered = (text: string): string => text.replace(/'/g, "&#x27;");

const readyGroup = { id: 3, member_count: 3, max_members: 4, status: "matched" } as const;

function promiseControls(nextAction: "promise" | "complete" | null, feedback = ""): string {
  return renderToStaticMarkup(
    <PromiseControls
      text=""
      onTextChange={() => {}}
      onPromise={() => {}}
      onComplete={() => {}}
      pending={null}
      feedback={feedback}
      feedbackTone="info"
      nextAction={nextAction}
    />,
  );
}

describe("portfolio demo narrative", () => {
  it("pins the agreed product copy", () => {
    expect(PRODUCT_PROMISE).toBe("Find your people. Keep your promise.");
    expect(PRIMARY_ACTIONS.findGroup).toBe("Find my study group");
    expect(PRIMARY_ACTIONS.startSprint).toBe("Start a focus sprint");
    expect(PRIMARY_ACTIONS.promise).toBe("Make today's promise");
    expect(PRIMARY_ACTIONS.complete).toBe("I'm done");
    expect(HEADINGS.board).toBe("Scoreboard");
  });

  it("renders the actions the demo clicks through", () => {
    const card = renderToStaticMarkup(<GroupCard group={readyGroup} onStart={() => {}} busy={false} />);
    expect(card).toContain(PRIMARY_ACTIONS.startSprint);

    const controls = promiseControls("promise");
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.promise));
    expect(controls).toMatch(/maxlength="280"/i);
  });

  it("stops offering a promise once one is recorded", () => {
    const controls = promiseControls("complete");
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.complete));
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.promise)); // still labelled, but disabled
    expect((controls.match(/disabled/g) ?? []).length).toBe(1);
  });

  it("surfaces duplicate-promise feedback instead of a success shape", () => {
    const controls = promiseControls("complete", "You already made a promise today.");
    expect(controls).toContain("You already made a promise today.");
    expect(controls).toContain("status--info");
  });
});