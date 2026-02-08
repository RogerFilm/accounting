"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils/cn";

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface AccountComboboxProps {
  accounts: AccountOption[];
  value: string;
  onChange: (accountId: string) => void;
  name?: string;
  placeholder?: string;
}

export function AccountCombobox({
  accounts,
  value,
  onChange,
  name,
  placeholder = "コードor科目名で検索",
}: AccountComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAccount = accounts.find((a) => a.id === value);

  const filtered = query
    ? accounts.filter(
        (a) =>
          a.code.includes(query.toLowerCase()) ||
          a.name.toLowerCase().includes(query.toLowerCase()),
      )
    : accounts;

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = useCallback(
    (accountId: string) => {
      onChange(accountId);
      setQuery("");
      setOpen(false);
    },
    [onChange],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightIndex]) {
          select(filtered[highlightIndex].id);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <input
        ref={inputRef}
        type="text"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
        placeholder={selectedAccount ? `${selectedAccount.code} ${selectedAccount.name}` : placeholder}
        value={open ? query : selectedAccount ? `${selectedAccount.code} ${selectedAccount.name}` : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((a, i) => (
            <li
              key={a.id}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                i === highlightIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                select(a.id);
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="text-muted-foreground">{a.code}</span>{" "}
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
