import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangedFiles, type ChangedFile } from "../src/ui/components/ChangedFiles";

describe("ChangedFiles - View diff button", () => {
  const mockFiles: ChangedFile[] = [
    {
      file_path: "src/test.ts",
      lines_added: 10,
      lines_removed: 5,
    },
    {
      file_path: "src/another.ts",
      lines_added: 3,
      lines_removed: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("отображает кнопку View diff когда передан onViewDiff", () => {
    const mockOnViewDiff = vi.fn();
    
    render(
      <ChangedFiles
        files={mockFiles}
        onViewDiff={mockOnViewDiff}
      />
    );

    const buttons = screen.getAllByText("View diff");
    expect(buttons).toHaveLength(2);
  });

  it("не отображает кнопку View diff когда onViewDiff не передан", () => {
    render(
      <ChangedFiles
        files={mockFiles}
      />
    );

    const buttons = screen.queryAllByText("View diff");
    expect(buttons).toHaveLength(0);
  });

  it("вызывает onViewDiff с правильным файлом при клике на кнопку", () => {
    const mockOnViewDiff = vi.fn();
    
    render(
      <ChangedFiles
        files={mockFiles}
        onViewDiff={mockOnViewDiff}
      />
    );

    const buttons = screen.getAllByText("View diff");
    fireEvent.click(buttons[0]);

    expect(mockOnViewDiff).toHaveBeenCalledTimes(1);
    expect(mockOnViewDiff).toHaveBeenCalledWith(mockFiles[0]);
  });

  it("вызывает onViewDiff с правильным файлом для каждого файла", () => {
    const mockOnViewDiff = vi.fn();
    
    render(
      <ChangedFiles
        files={mockFiles}
        onViewDiff={mockOnViewDiff}
      />
    );

    const buttons = screen.getAllByText("View diff");
    
    fireEvent.click(buttons[0]);
    expect(mockOnViewDiff).toHaveBeenCalledWith(mockFiles[0]);
    
    fireEvent.click(buttons[1]);
    expect(mockOnViewDiff).toHaveBeenCalledWith(mockFiles[1]);
    
    expect(mockOnViewDiff).toHaveBeenCalledTimes(2);
  });

  it("отображает правильное количество добавленных и удаленных строк", () => {
    const mockOnViewDiff = vi.fn();
    
    render(
      <ChangedFiles
        files={mockFiles}
        onViewDiff={mockOnViewDiff}
      />
    );

    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("отображает правильные пути к файлам", () => {
    const mockOnViewDiff = vi.fn();
    
    render(
      <ChangedFiles
        files={mockFiles}
        onViewDiff={mockOnViewDiff}
      />
    );

    expect(screen.getByText("src/test.ts")).toBeInTheDocument();
    expect(screen.getByText("src/another.ts")).toBeInTheDocument();
  });

  it("работает с пустым массивом файлов", () => {
    const mockOnViewDiff = vi.fn();
    
    const { container } = render(
      <ChangedFiles
        files={[]}
        onViewDiff={mockOnViewDiff}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
