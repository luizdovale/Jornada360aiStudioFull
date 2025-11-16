import React from 'react';

// Este componente representa o ícone da aplicação Jornada360.
// Agora usa um arquivo SVG externo para consistência.
const Jornada360Icon: React.FC<{ className?: string }> = ({ className }) => (
    <img src="/assets/logo.svg" alt="Jornada360 Logo" className={className} />
);

export default Jornada360Icon;
