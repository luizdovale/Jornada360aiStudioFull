import React from 'react';
import { Truck } from 'lucide-react';

// Este componente representa o ícone da aplicação Jornada360.
const Jornada360Icon: React.FC<{ className?: string }> = ({ className }) => (
    <Truck className={className} />
);

export default Jornada360Icon;
