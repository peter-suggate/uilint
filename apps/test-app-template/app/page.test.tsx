import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Home from "./page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Home Page", () => {
  describe("Hero Section", () => {
    it("renders the main heading", () => {
      render(<Home />);
      expect(screen.getByText(/Welcome to/)).toBeInTheDocument();
      expect(screen.getByText("TodoApp")).toBeInTheDocument();
    });

    it("renders navigation links", () => {
      render(<Home />);
      expect(screen.getByText("View Todos")).toBeInTheDocument();
      expect(screen.getByText("Get Started")).toBeInTheDocument();
      expect(screen.getByText("Configure Settings")).toBeInTheDocument();
    });
  });

  describe("Features Section", () => {
    it("renders feature cards", () => {
      render(<Home />);
      expect(screen.getByText("Task Management")).toBeInTheDocument();
      expect(screen.getByText("Goal Tracking")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });
  });

  describe("Modal interactions", () => {
    it("opens custom modal when button clicked", () => {
      render(<Home />);

      // Modal should not be visible initially
      expect(screen.queryByText("Modal Title")).not.toBeInTheDocument();

      // Click to open modal
      fireEvent.click(screen.getByText("Open Modal"));

      // Modal should now be visible
      expect(screen.getByText("Modal Title")).toBeInTheDocument();
      expect(screen.getByText("This modal has inconsistent dark mode theming")).toBeInTheDocument();
    });

    it("closes custom modal when cancel clicked", () => {
      render(<Home />);

      // Open modal
      fireEvent.click(screen.getByText("Open Modal"));
      expect(screen.getByText("Modal Title")).toBeInTheDocument();

      // Click cancel
      fireEvent.click(screen.getByText("Cancel"));

      // Modal should be closed
      expect(screen.queryByText("Modal Title")).not.toBeInTheDocument();
    });
  });

  describe("CTA Section", () => {
    it("renders call to action", () => {
      render(<Home />);
      expect(screen.getByText("Ready to Get Started?")).toBeInTheDocument();
      expect(screen.getByText("Open Todo List")).toBeInTheDocument();
    });
  });
});
