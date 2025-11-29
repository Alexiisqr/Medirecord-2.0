import React from 'react';
import { Home, PlusCircle, FileText, Settings, Trophy } from 'lucide-react';
import { View, Theme } from '../types';

interface NavigationProps {
  currentView: View;
  onChangeView: (view: View) => void;
  theme: Theme;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView, theme }) => {
  const navItemClass = (view: View) => `
    flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300
    ${currentView === view ? theme.classes.primary : theme.classes.textSec}
  `;

  return (
    <div className={`h-20 ${theme.classes.nav} backdrop-blur-md border-t ${theme.classes.cardBorder} flex justify-around items-center px-2 pb-2 shadow-[0_-4px_30px_rgba(0,0,0,0.05)] z-50 transition-colors duration-500`}>
      <button className={navItemClass('dashboard')} onClick={() => onChangeView('dashboard')}>
        <Home size={24} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Inicio</span>
      </button>

      <button className={navItemClass('achievements')} onClick={() => onChangeView('achievements')}>
        <Trophy size={24} strokeWidth={currentView === 'achievements' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Logros</span>
      </button>
      
      <div className="relative -top-6">
        <button 
          className={`h-16 w-16 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-90 ${theme.id === 'cyber' ? 'bg-cyan-400 text-black shadow-cyan-400/50' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-400/50'}`}
          onClick={() => onChangeView('add')}
        >
          <PlusCircle size={32} />
        </button>
      </div>

      <button className={navItemClass('profile')} onClick={() => onChangeView('profile')}>
        <FileText size={24} strokeWidth={currentView === 'profile' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Historial</span>
      </button>

      <button className={navItemClass('settings')} onClick={() => onChangeView('settings')}>
        <Settings size={24} strokeWidth={currentView === 'settings' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Ajustes</span>
      </button>
    </div>
  );
};