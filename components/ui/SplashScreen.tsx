import React from 'react';

interface SplashScreenProps {
  status?: string;
  subtext?: string;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ 
  status = "VALIDANDO IDENTIDADE", 
  subtext = "Acesso Seguro Jornada360" 
}) => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1E263C] overflow-hidden">
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1E263C] via-[#1E263C] to-[#151B2C]" />
      
      {/* Decorative Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[80px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative flex flex-col items-center">
        {/* Logo Container with Animations */}
        <div className="relative mb-8 group">
          {/* Outer Ring Animation */}
          <div className="absolute -inset-4 bg-accent/20 rounded-full blur-xl animate-pulse scale-110 opacity-50" />
          
          {/* App Icon */}
          <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white/5 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10 flex items-center justify-center animate-in zoom-in duration-1000">
            <img 
              src="assets/icon/icon_app.png" 
              alt="Jornada360 Logo" 
              className="w-full h-full object-contain drop-shadow-2xl animate-bounce-slow"
            />
          </div>

          {/* Glowing Effect under the Icon */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-accent/40 blur-md rounded-full animate-pulse" />
        </div>

        {/* Text Content */}
        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
            <span className="text-white font-bold tracking-[0.2em] text-xs md:text-sm uppercase">
              {status}
            </span>
          </div>
          <p className="text-white/40 text-[9px] md:text-[10px] uppercase tracking-[0.3em] font-medium">
            {subtext}
          </p>
        </div>

        {/* Progress indicator (Subtle) */}
        <div className="absolute -bottom-24 w-48 h-[1px] bg-white/5 overflow-hidden">
            <div className="h-full bg-accent/50 w-full animate-shimmer" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default SplashScreen;
