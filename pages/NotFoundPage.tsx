
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

const NotFoundPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-primary-light flex flex-col items-center justify-center text-center p-4">
            <AlertTriangle className="w-16 h-16 text-accent mb-4" />
            <h1 className="text-4xl font-bold text-primary-dark">404</h1>
            <p className="text-xl text-primary-dark mt-2">Página não encontrada</p>
            <p className="text-muted-foreground mt-4">A página que você está procurando não existe ou foi movida.</p>
            <Link to="/" className="mt-8 inline-block bg-primary text-white font-semibold py-3 px-6 rounded-lg hover:bg-primary-dark transition-colors">
                Voltar para a Home
            </Link>
        </div>
    );
};

export default NotFoundPage;
