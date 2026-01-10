
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Menu, User as UserIcon, Home, Loader2, Plus } from 'lucide-react';
// @ts-ignore
import { Link, useLocation } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const { user, updateUserMetadata } = useAuth();
    const { toast } = useToast();
    const location = useLocation();
    
    const fullUserName = user?.user_metadata?.nome || 'Usuário';
    const userName = fullUserName.trim().split(' ')[0];
    
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isHomePage = location.pathname === '/';

    useEffect(() => {
        if (user?.user_metadata?.avatar_url) {
            setAvatarUrl(user.user_metadata.avatar_url);
        } else {
            setAvatarUrl(null);
        }
    }, [user]);

    const handleAvatarClick = () => {
        if (uploading) return;
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = event.target.files?.[0];
            if (!file || !user) return;
            if (!file.type.startsWith('image/')) return;
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            await updateUserMetadata({ avatar_url: publicUrl });
            setAvatarUrl(publicUrl);
            toast({ title: "Sucesso", description: "Foto atualizada." });
        } catch (error: any) {
            toast({ title: "Erro", description: "Falha ao atualizar foto.", variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <header className="bg-primary pt-10 pb-20 px-5 text-white">
            <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <button onClick={onMenuClick} className="w-9 h-9 rounded-full bg-primary-dark/40 flex items-center justify-center text-white transition hover:bg-primary-dark/60">
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {isHomePage ? (
                            <Link to="/journeys/new" className="w-9 h-9 rounded-full bg-accent text-primary-dark flex items-center justify-center shadow-lg transition active:scale-95">
                                <Plus className="w-5 h-5" />
                            </Link>
                        ) : (
                            <Link to="/" className="w-9 h-9 rounded-full bg-primary-dark/40 flex items-center justify-center text-white transition hover:bg-primary-dark/60">
                                <Home className="w-5 h-5" />
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div 
                        onClick={handleAvatarClick}
                        className={`w-14 h-14 rounded-full bg-primary-light flex items-center justify-center text-primary-dark overflow-hidden cursor-pointer relative border-2 border-transparent hover:border-accent transition-all ${uploading ? 'opacity-70' : ''}`}
                    >
                       {uploading ? (
                           <Loader2 className="w-6 h-6 animate-spin text-primary-dark" />
                       ) : avatarUrl ? (
                           <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                       ) : (
                           <UserIcon className="w-8 h-8" />
                       )}
                       <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" disabled={uploading} />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                            Olá,
                        </p>
                        <div className="flex items-center gap-2">
                            <p className="text-xl font-bold">{userName}</p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
