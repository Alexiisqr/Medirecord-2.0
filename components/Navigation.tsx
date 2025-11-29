import React from 'react';
import { Home, PlusCircle, FileText } from 'lucide-react';
import { View } from '../types';

interface NavigationProps {
  currentView: View;
  onChangeView: (view: View) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const navItemClass = (view: View) => `
    flex flex-col items-center justify-center gap-1 w-full h-full transition-colors
    ${currentView === view ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}
  `;

  return (
    <div className="h-20 bg-white border-t border-slate-100 flex justify-around items-center px-2 pb-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50">
      <button className={navItemClass('dashboard')} onClick={() => onChangeView('dashboard')}>
        <Home size={24} strokeWidth={currentView === 'dashboard' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Inicio</span>
      </button>
      
      <div className="relative -top-6">
        <button 
          className="bg-blue-600 text-white rounded-full p-4 shadow-xl shadow-blue-300 active:scale-95 transition-transform"
          onClick={() => onChangeView('add')}
        >
          <PlusCircle size={32} />
        </button>
      </div>

      <button className={navItemClass('profile')} onClick={() => onChangeView('profile')}>
        <FileText size={24} strokeWidth={currentView === 'profile' ? 2.5 : 2} />
        <span className="text-[10px] font-medium">Historial</span>
      </button>
    </div>
  );
};