
import React from 'react';
// @ts-ignore
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user, loading, isAdmin, adminLoading } = useAuth();

    if (loading || adminLoading) {
        return (
            <div className="min-h-screen bg-primary-dark flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-accent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;
