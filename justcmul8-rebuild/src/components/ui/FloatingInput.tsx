import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
}

export function FloatingInput({ label, icon, type, value, ...props }: FloatingInputProps) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPw ? "text" : "password") : type;
  const hasValue = value !== undefined && String(value).length > 0;

  return (
    <div className="pt-4 mt-1">
      <div className="relative group rounded-full bg-white">
        <input 
          type={inputType}
          value={value}
          className={`peer w-full pl-[44px] ${isPassword ? 'pr-12' : 'pr-4'} py-2.5 lg:py-3 border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-full focus:outline-none focus:ring-4 focus:ring-[#6C5CE7]/10 focus:border-[#6C5CE7] text-[#111827] text-[14px] bg-transparent transition-all duration-300 placeholder-transparent relative z-20`}
          placeholder={label}
          {...props}
        />
        <label 
          htmlFor={props.id} 
          className={`absolute left-[16px] px-1 pointer-events-none transition-all duration-200 ease-out origin-left z-30 bg-transparent ${hasValue ? '-top-6 translate-y-0 scale-[0.85] text-[#9CA3AF]' : 'left-[40px] top-1/2 -translate-y-1/2 text-[14px] text-[#9CA3AF]'} peer-focus:-top-6 peer-focus:translate-y-0 peer-focus:scale-[0.85] peer-focus:text-[#6C5CE7] peer-focus:left-[16px]`}
        >
          {label}
        </label>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#9CA3AF] peer-focus:text-[#6C5CE7] transition-colors duration-300 ease-out z-20">
          {icon}
        </div>
        {isPassword && (
          <button 
            type="button" 
            onClick={() => setShowPw(!showPw)} 
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#9CA3AF] hover:text-[#4B5563] transition-colors z-30"
          >
            {showPw ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
          </button>
        )}
      </div>
    </div>
  );
}
