
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AuthInputProps {
    id: string;
    label: string;
    type?: 'text' | 'email' | 'password';
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    autoComplete?: string;
    icon?: React.ReactNode;
}

const AuthInput: React.FC<AuthInputProps> = ({
    id,
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required,
    minLength,
    autoComplete,
    icon,
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wider"
            >
                {label}
            </label>
            <div className="relative">
                {icon && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        {icon}
                    </span>
                )}
                <input
                    id={id}
                    type={inputType}
                    value={value}
                    onChange={onChange}
                    required={required}
                    minLength={minLength}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    className={`w-full ${icon ? 'pl-10' : 'pl-4'} ${isPassword ? 'pr-10' : 'pr-4'} py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all text-sm`}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                )}
            </div>
        </div>
    );
};

export default AuthInput;
