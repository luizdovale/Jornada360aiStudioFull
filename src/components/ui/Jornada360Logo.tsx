import React from 'react';

const Jornada360Logo: React.FC<{ className?: string }> = ({ className }) => (
    <div className="flex items-center gap-3">
        <img src="/assets/logo.png" alt="Jornada360 Logo" className={className} />
        <span className="text-white font-bold text-lg">Jornada360</span>
    </div>
);

export default Jornada360Logo;
