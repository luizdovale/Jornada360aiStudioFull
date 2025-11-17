import React from 'react';
import Jornada360Icon from './Jornada360Icon';

interface Jornada360LogoProps {
  variant?: 'sidebar' | 'pageHeader';
}

const Jornada360Logo: React.FC<Jornada360LogoProps> = ({ variant = 'sidebar' }) => {
    if (variant === 'pageHeader') {
        return (
            <div className="mb-8 text-center flex flex-col items-center">
                <Jornada360Icon className="w-20 h-20 mb-4 text-accent" />
                <h1 className="text-2xl font-bold text-white">Jornada360</h1>
            </div>
        );
    }

    // sidebar variant is default
    return (
        <div className="flex items-center gap-3">
            <Jornada360Icon className="w-8 h-8 text-accent" />
            <span className="text-white font-bold text-lg">Jornada360</span>
        </div>
    );
};

export default Jornada360Logo;
