import React, { useState } from 'react';
import { Clock, Check, Trash2, AlertCircle, Utensils, Zap, AlertTriangle, ChevronDown, ChevronUp, Edit2, Timer, Package, Info } from 'lucide-react';
import { Medication, FrequencyType, Theme } from '../types';

interface MedicationCardProps {
  medication: Medication;
  onTake: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (med: Medication) => void;
  onSnooze: (id: string, minutes: number) => void;
  theme: Theme;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onTake, onDelete, onEdit, onSnooze, theme }) => {
  const [showAdvice, setShowAdvice] = useState(false);

  const getFrequencyText = () => {
    switch (medication.frequencyType) {
      case FrequencyType.HOURLY: return `Cada ${medication.frequencyValue} horas`;
      case FrequencyType.DAILY: return `${medication.frequencyValue} vez al día`;
      case FrequencyType.WEEKLY: return `Cada ${medication.frequencyValue} semanas`;
      case FrequencyType.AS_NEEDED: return `Si es necesario`;
      default: return '';
    }
  };

  const isDue = () => {
    if (!medication.nextDose) return true;
    return new Date(medication.nextDose).getTime() <= new Date().getTime();
  };

  const due = isDue();
  const hasAdvice = !!medication.advice;
  const inventory = medication.inventory ?? 0;
  const lowStock = inventory <= 5 && inventory > 0;
  const noStock = inventory === 0;

  // Dynamic colors based on theme mode
  const isDark = theme.id === 'dark' || theme.id === 'cyber';

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${theme.classes.card} border ${theme.classes.cardBorder} shadow-sm group`}>
      {/* Decorative gradient bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${medication.color} opacity-80`}></div>
      
      <div className="flex justify-between items-start pl-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-xl font-bold leading-tight ${theme.classes.textMain}`}>{medication.name}</h3>
            {lowStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/20"><AlertTriangle size={10} /> Quedan {inventory}</span>}
            {noStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20"><AlertCircle size={10} /> Agotado</span>}
          </div>
          {/* AI DESCRIPTION */}
          {medication.description && (
             <p className={`text-xs mt-1 italic flex items-center gap-1 opacity-70 ${theme.classes.textMain}`}>
                <Info size={10} /> {medication.description}
             </p>
          )}
          <p className={`text-sm font-medium mt-1 ${theme.classes.textSec}`}>{medication.dosage}</p>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(medication); }}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/10 hover:text-white' : 'text-slate-300 hover:bg-slate-100 hover:text-blue-500'}`}
          >
            <Edit2 size={18} />
          </button>
           <button 
            onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar este medicamento?')) onDelete(medication.id); }}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/10 hover:text-red-400' : 'text-slate-300 hover:bg-red-50 hover:text-red-500'}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-3 mt-3">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          <Clock size={12} />
          {getFrequencyText()}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${lowStock ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : (isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 text-slate-600 border-slate-100')}`}>
          <Package size={12} />
          Stock: {inventory}
        </span>
        {medication.notes && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 text-xs font-semibold text-yellow-600 border border-yellow-500/20 truncate max-w-[150px]">
            <AlertCircle size={12} />
            {medication.notes}
          </span>
        )}
      </div>

      {hasAdvice && (
        <div className="pl-3 mt-2">
          <button 
            onClick={() => setShowAdvice(!showAdvice)}
            className={`text-xs font-medium flex items-center gap-1 hover:underline mt-2 ${theme.classes.primary}`}
          >
            {showAdvice ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {showAdvice ? 'Ocultar recomendaciones' : 'Ver riesgos y recomendaciones'}
          </button>
          
          {showAdvice && (
            <div className={`mt-3 p-3 rounded-xl border space-y-2 text-sm animate-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-blue-900/20 border-blue-500/20 text-blue-100' : 'bg-blue-50/50 border-blue-100 text-slate-700'}`}>
              <div className="flex gap-2 items-start">
                 <Utensils size={16} className="text-blue-500 mt-0.5 shrink-0" />
                 <div><span className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>Alimentos:</span> {medication.advice?.food}</div>
              </div>
              <div className="flex gap-2 items-start">
                 <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                 <div><span className={`font-semibold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>Interacciones:</span> {medication.advice?.interactions}</div>
              </div>
              <div className="flex gap-2 items-start">
                 <Zap size={16} className="text-purple-500 mt-0.5 shrink-0" />
                 <div><span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>Efectos:</span> {medication.advice?.sideEffects}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {due ? (
        <div className="flex gap-2 mt-4 mx-2">
           <button 
            onClick={() => onSnooze(medication.id, 15)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium active:scale-95 transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Timer size={18} />
            <span className="text-xs sm:text-sm">Posponer</span>
          </button>
          <button 
            onClick={() => onTake(medication.id)}
            disabled={noStock}
            className={`flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl font-bold active:scale-95 transition-all shadow-lg ${noStock ? 'bg-slate-400 cursor-not-allowed opacity-50' : (theme.id === 'cyber' ? 'bg-cyan-400 text-black shadow-cyan-400/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30')}`}
          >
            <Check size={18} />
            {noStock ? 'Sin Stock' : 'Tomar Ahora'}
          </button>
        </div>
      ) : (
        <div className={`mt-4 mx-2 py-2.5 text-center text-sm font-medium rounded-xl border ${isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          Próxima: {new Date(medication.nextDose!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      )}
    </div>
  );
};