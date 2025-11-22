import React from 'react';

// Este componente SVG representa o ícone personalizado da aplicação Jornada360.
// Foi criado com base na imagem fornecida para manter a identidade visual.
const Jornada360Icon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        viewBox="0 0 50 50" 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
        fill="currentColor"
    >
        <path 
            fillRule="evenodd" 
            clipRule="evenodd" 
            d="M25 50C38.8071 50 50 38.8071 50 25C50 11.1929 38.8071 0 25 0C11.1929 0 0 11.1929 0 25C0 38.8071 11.1929 50 25 50ZM25 45C36.0457 45 45 36.0457 45 25C45 13.9543 36.0457 5 25 5C13.9543 5 5 13.9543 5 25C5 36.0457 13.9543 45 25 45Z" 
        />
        <path d="M23 11V26H38V21H28V11H23Z" />
        <path d="M18 23C19.1046 23 20 23.8954 20 25C20 26.1046 19.1046 27 18 27C16.8954 27 16 26.1046 16 25C16 23.8954 16.8954 23 18 23Z" />
        <path d="M18.8143 33L13.5 44H19L22.2571 36.5H27.7429L31 44H36.5L31.1857 33H18.8143Z" />
        <path d="M23.5 37H26.5L25 41.5L23.5 37Z" />
    </svg>
);

export default Jornada360Icon;