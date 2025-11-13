
import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-primary text-foreground font-sans">
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            <div className="flex flex-col min-h-screen">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 bg-background rounded-t-3xl shadow-soft">
                    <div className="max-w-md mx-auto px-4 pb-8 pt-4 md:max-w-2xl lg:max-w-4xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;