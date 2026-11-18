import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ASAAS_CHECKOUT_FOR_EVERYONE } from '../lib/featureFlags';
import SubscriptionPageAsaas from './SubscriptionPageAsaas';
import SubscriptionPageMercadoPago from './SubscriptionPageMercadoPago';

// Escolhe a tela de assinatura: Asaas para todos (quando liberado) ou só para
// administradores durante os testes no sandbox.
const SubscriptionPage: React.FC = () => {
    const { isAdmin, adminLoading } = useAuth();

    if (!ASAAS_CHECKOUT_FOR_EVERYONE && adminLoading) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    return ASAAS_CHECKOUT_FOR_EVERYONE || isAdmin ? <SubscriptionPageAsaas /> : <SubscriptionPageMercadoPago />;
};

export default SubscriptionPage;
