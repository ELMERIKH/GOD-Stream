import { fireEvent, render, screen } from "@testing-library/react";
import WatchRail, { nextRailOffset, railWindow } from "./WatchRail";

test("a newest-first episode rail can page back to episode 1", () => {
  const episodes = Array.from({ length: 100 }, (_, index) => ({
    number: 100 - index,
    title: `Episode ${100 - index}`,
  }));
  const first = railWindow(episodes, 0, "", 0, 36);
  expect(first.visible[0].item.number).toBe(100);
  expect(first.visible.some((row) => row.item.number === 1)).toBe(false);
  expect(first.hasEarlier).toBe(true);
  expect(first.hasNewer).toBe(false);

  let offset = 0;
  while (railWindow(episodes, 0, "", offset, 36).hasEarlier) {
    offset = nextRailOffset(100, offset, "earlier", 36);
  }
  const last = railWindow(episodes, 0, "", offset, 36);
  expect(last.visible.some((row) => row.item.number === 1)).toBe(true);
  expect(last.visible.some((row) => row.index === 0)).toBe(true);
  expect(last.hasEarlier).toBe(false);
  expect(last.hasNewer).toBe(true);
});

test("an oldest-first chapter rail starts at the newest page and can reach chapter 1", () => {
  const chapters = Array.from({ length: 135 }, (_, index) => ({
    number: index + 1,
    title: `Chapter ${index + 1}`,
  }));
  const newest = railWindow(chapters, 134, "", 0, 36);
  expect(newest.visible.some((row) => row.item.number === 135)).toBe(true);
  expect(newest.visible.some((row) => row.item.number === 1)).toBe(false);

  let offset = 0;
  while (railWindow(chapters, 134, "", offset, 36).hasEarlier) {
    offset = nextRailOffset(135, offset, "earlier", 36);
  }
  const earliest = railWindow(chapters, 134, "", offset, 36);
  expect(earliest.visible.some((row) => row.item.number === 1)).toBe(true);
  expect(earliest.visible.some((row) => row.item.number === 135)).toBe(true);
});

test("the mobile chapter panel is closed by default", () => {
  const onSelect = jest.fn();
  render(
    <WatchRail
      label="Chapters"
      query=""
      onQuery={() => {}}
      items={[{ number: 423, title: "Chapter 423" }]}
      selectedIndex={0}
      onSelect={onSelect}
      emptyNote="No chapter list is available for this title."
    />
  );
  const rail = screen.getByRole("complementary", { name: "Chapters" });
  const toggle = screen.getByRole("button", { name: "Chapters" });
  expect(rail).not.toHaveClass("is-open");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Close Chapters" })).not.toBeInTheDocument();

  fireEvent.click(toggle);
  expect(rail).toHaveClass("is-open");
  expect(toggle).toHaveAttribute("aria-expanded", "true");

  fireEvent.click(screen.getByRole("button", { name: "Close Chapters" }));
  expect(rail).not.toHaveClass("is-open");

  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole("button", { name: "Chapter 423" }));
  expect(onSelect).toHaveBeenCalledWith(0);
  expect(rail).not.toHaveClass("is-open");
});

test("the filter still jumps to a chapter number", () => {
  const chapters = Array.from({ length: 80 }, (_, index) => ({
    number: index + 1,
    title: `Chapter ${index + 1}`,
  }));
  const matched = railWindow(chapters, 0, "1", 40, 36);
  expect(matched.visible[0].item.number).toBe(1);
  expect(matched.hasEarlier).toBe(false);
});
