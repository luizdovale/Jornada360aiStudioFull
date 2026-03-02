
import React from 'react';

interface AuthLayoutProps {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6">
            <div className="max-w-sm mx-auto w-full">

                {/* Header com logo */}
                <div className="mb-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 mb-4 flex items-center justify-center">
                        <img src="/assets/icone_pdf.png" alt="Jornada360" className="w-16 h-16 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                    {subtitle && (
                        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
                    )}
                </div>

                {/* Card de conteúdo */}
                <div className="bg-white rounded-2xl shadow-soft border border-gray-100 p-8">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default AuthLayout;
