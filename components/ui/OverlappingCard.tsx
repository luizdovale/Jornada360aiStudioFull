
import React from 'react';

const OverlappingCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="relative w-full">
            {/* Card de fundo 1 */}
            <div className="absolute inset-x-3 top-4 h-full rounded-3xl bg-primary/80 shadow-card scale-[0.94] opacity-60" />
            {/* Card de fundo 2 */}
            <div className="absolute inset-x-6 top-8 h-full rounded-3xl bg-primary/50 shadow-card scale-[0.88] opacity-40" />
            {/* Card principal */}
            <div className="relative rounded-3xl bg-primary shadow-floating px-5 py-5 text-white transition-transform duration-200 hover:-translate-y-1">
                {children}
            </div>
        </div>
    );
};

export default OverlappingCard;
