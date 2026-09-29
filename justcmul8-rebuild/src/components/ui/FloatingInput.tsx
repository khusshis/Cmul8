import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
}

// Label sits inside the field and glides to the top on focus / when filled (landing theme).

export function FloatingInput({ label, icon, type, value, ...props }: FloatingInputProps) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPw ? "text" : "password") : type;

  return (
    <div className="relative">
      <input
        type={inputType}
        value={value}
        placeholder={label}
        className={`peer w-full h-[56px] rounded-2xl border border-[#e7e5f6] bg-white pl-12 ${isPassword ? "pr-12" : "pr-4"} pt-[20px] pb-[6px] text-[14.5px] text-[#161622] outline-none placeholder-transparent transition-[border-color,box-shadow] duration-200 hover:border-[#d4cff5] focus:border-[#8b5cf6] focus:shadow-[0_0_0_4px_rgba(139,92,246,.14)]`}
        {...props}
      />
      <label
        htmlFor={props.id}
        className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-[14.5px] text-[#94a3b8] transition-all duration-200 ease-out peer-focus:top-[15px] peer-focus:text-[11px] peer-focus:font-semibold peer-focus:text-[#7c3aed] peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-semibold peer-autofill:top-[15px] peer-autofill:text-[11px]"
      >
        {label}
      </label>
      <div className="pointer-events-none absolute inset-y-0 left-0 pl-4 flex items-center text-[#a5a3c2] peer-focus:text-[#7c3aed] transition-colors duration-200">
        {icon}
      </div>
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPw(!showPw)}
          aria-label={showPw ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#a5a3c2] hover:text-[#5742FF] transition-colors"
        >
          {showPw ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
        </button>
      )}
    </div>
  );
}
