import React from 'react';

interface SplashScreenProps {
  status?: string;
  subtext?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  status = "VALIDANDO IDENTIDADE", 
  subtext = "Jornada360 - Controle de Jornada" 
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1E263C] overflow-hidden">
      {/* Background Animated Gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-[#2A3552] to-[#1E263C] opacity-50" />
      
      {/* Soft Ambient Light */}
      <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[120px] animate-pulse" />

      <div className="relative flex flex-col items-center">
        {/* Logo Container - Cleaner without heavy borders */}
        <div className="relative mb-12 animate-in zoom-in duration-700">
          {/* Subtle Glow behind logo */}
          <div className="absolute inset-0 bg-accent/20 rounded-full blur-[40px] scale-150 opacity-40 animate-pulse" />
          
          {/* App Icon - Direct usage as it's transparent */}
          <div className="relative w-40 h-40 md:w-52 md:h-52 flex items-center justify-center">
            <img 
              src="/assets/icon_splash.png" 
              alt="Jornada360" 
              className="w-full h-full object-contain drop-shadow-[0_10px_30px_rgba(248,196,0,0.3)] animate-float"
            />
          </div>
        </div>

        {/* Status Text - More elegant */}
        <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="flex items-center gap-4">
             <div className="flex gap-1.5">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
             </div>
             <span className="text-white font-semibold tracking-[0.3em] text-[10px] md:text-xs uppercase opacity-80">
              {status}
            </span>
          </div>
          <p className="text-white/30 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-light">
            {subtext}
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .bg-gradient-radial {
          background: radial-gradient(circle at center, var(--tw-gradient-from), var(--tw-gradient-to));
        }
      `}} />
    </div>
  );
};

export default SplashScreen;
