import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  full_name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (mentions: string[]) => void;
  members: Member[];
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
}

export interface MentionInputRef {
  focus: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const MentionInput = forwardRef<MentionInputRef, MentionInputProps>(
  (
    {
      value,
      onChange,
      onMentionsChange,
      members,
      placeholder,
      disabled,
      onKeyDown,
      className,
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionFilter, setSuggestionFilter] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }));

    const filteredMembers = members.filter((m) =>
      m.full_name.toLowerCase().includes(suggestionFilter.toLowerCase())
    );

    useEffect(() => {
      setSelectedIndex(0);
    }, [suggestionFilter]);

    const extractMentions = (text: string): string[] => {
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[2]);
      }
      return mentions;
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart;
      setCursorPosition(cursor);
      onChange(newValue);

      const textBeforeCursor = newValue.slice(0, cursor);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (atMatch) {
        setSuggestionFilter(atMatch[1]);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }

      if (onMentionsChange) {
        onMentionsChange(extractMentions(newValue));
      }
    };

    const insertMention = (member: Member) => {
      const textBeforeCursor = value.slice(0, cursorPosition);
      const textAfterCursor = value.slice(cursorPosition);
      const atIndex = textBeforeCursor.lastIndexOf("@");

      if (atIndex !== -1) {
        const newText =
          textBeforeCursor.slice(0, atIndex) +
          `@[${member.full_name}](${member.id}) ` +
          textAfterCursor;
        onChange(newText);
        setShowSuggestions(false);

        if (onMentionsChange) {
          onMentionsChange(extractMentions(newText));
        }

        setTimeout(() => {
          textareaRef.current?.focus();
        }, 0);
      }
    };

    const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showSuggestions && filteredMembers.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredMembers.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredMembers.length - 1
          );
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(filteredMembers[selectedIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowSuggestions(false);
          return;
        }
      }
      onKeyDown?.(e);
    };

    const displayValue = value.replace(
      /@\[([^\]]+)\]\([^)]+\)/g,
      "@$1"
    );

    return (
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDownInternal}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("min-h-[40px] resize-none", className)}
          rows={1}
        />

        {showSuggestions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg z-50">
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent",
                  index === selectedIndex && "bg-accent"
                )}
                onClick={() => insertMention(member)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span>{member.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = "MentionInput";
