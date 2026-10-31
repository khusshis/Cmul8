"use client";

import React, { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: number | undefined;
  /** Called only with values that pass min / max / integer / valid, so a half-typed entry never reaches the model. */
  onChange: (value: number) => void;
  integer?: boolean;
  /** Extra rule on top of min/max (e.g. "greater than 0"). */
  valid?: (n: number) => boolean;
};

/**
 * A number box you can clear and retype. Binding the box straight to the saved value meant clearing
 * it produced 0 or got clamped back at once (capacity "2" could never become "5"). What you type is
 * kept as a draft; it is saved as soon as it is a valid number, and on leaving the box an empty or
 * invalid draft snaps back to the last saved value.
 */
export default function NumberInput({ value, onChange, integer, valid, min, max, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const ok = (n: number) =>
    Number.isFinite(n) &&
    (min === undefined || n >= Number(min)) &&
    (max === undefined || n <= Number(max)) &&
    (!integer || Number.isInteger(n)) &&
    (!valid || valid(n));

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      step={rest.step ?? (integer ? 1 : "any")}
      value={draft ?? (value === undefined || Number.isNaN(value) ? "" : value)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        if (raw.trim() !== "" && ok(n) && n !== value) onChange(n);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
    />
  );
}
