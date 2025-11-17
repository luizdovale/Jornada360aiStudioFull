import React from 'react';

// Este componente representa o ícone da aplicação Jornada360.
const Jornada360Icon: React.FC<{ className?: string }> = ({ className }) => (
    <img src="/assets/logo.png" alt="Jornada360 Logo" className={className} />
);

export default Jornada360Icon;
